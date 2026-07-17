import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { mkdir, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import type { PhotoStatus } from "../types";

const photosRouter = new Hono();

// Delete a previously-uploaded finished photo from storage.vibecodeapp.com.
// Best-effort: logs but never throws so purge/delete flows always complete.
const deleteFromRemoteStorage = async (fileUrl: string): Promise<void> => {
  try {
    // storage.vibecodeapp.com URLs look like https://storage.vibecodeapp.com/.../<fileId>/<filename>
    const match = fileUrl.match(/storage\.vibecodeapp\.com\/.*?\/([^/]+)\/[^/]+$/);
    const fileId = match?.[1];
    if (!fileId) return;
    await fetch(`https://storage.vibecodeapp.com/v1/files/${fileId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("[Photos] Failed to delete remote file:", fileUrl, error);
  }
};

// Ensure uploads directory exists
const UPLOADS_DIR = join(process.cwd(), "uploads");
const ensureUploadsDir = async () => {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
};

// GET /api/photos - List photos (filter by teamId, eventId, status)
photosRouter.get("/", async (c) => {
  const teamId = c.req.query("teamId");
  const eventId = c.req.query("eventId");
  const status = c.req.query("status");

  const photos = await prisma.photo.findMany({
    where: {
      ...(teamId && { teamId }),
      ...(eventId && { eventId }),
      ...(status && { status }),
    },
    include: {
      team: {
        select: { id: true, name: true, code: true },
      },
      event: {
        select: { id: true, venueName: true, venueCity: true, venueState: true, eventDate: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: photos });
});

// POST /api/photos/upload - Upload photo (multipart/form-data with file, teamId, eventId, overlayType)
// IMPORTANT: This route must be defined BEFORE /:id routes
photosRouter.post("/upload", async (c) => {
  try {
    await ensureUploadsDir();

    const formData = await c.req.formData();
    const fileData = formData.get("file");
    const teamId = formData.get("teamId") as string | null;
    const eventId = formData.get("eventId") as string | null;
    const overlayType = formData.get("overlayType") as string | null;
    const localId = formData.get("localId") as string | null;

    console.log("[PhotoUpload] Received upload request:", { teamId, eventId, overlayType, localId, hasFile: !!fileData });

    if (!fileData) {
      return c.json({ error: { message: "File is required", code: "FILE_REQUIRED" } }, 400);
    }
    if (!teamId) {
      return c.json({ error: { message: "Team ID is required", code: "TEAM_ID_REQUIRED" } }, 400);
    }
    if (!eventId) {
      return c.json({ error: { message: "Event ID is required", code: "EVENT_ID_REQUIRED" } }, 400);
    }
    if (!overlayType) {
      return c.json({ error: { message: "Overlay type is required", code: "OVERLAY_TYPE_REQUIRED" } }, 400);
    }

    // Check for duplicate localId if provided
    if (localId) {
      const existingPhoto = await prisma.photo.findUnique({
        where: { localId },
      });

      if (existingPhoto) {
        console.log("[PhotoUpload] Found existing photo with localId:", localId);
        // Return same format for idempotency
        return c.json({
          data: {
            success: true,
            localId: existingPhoto.localId,
            remoteUrl: existingPhoto.storageUrl,
            photo: existingPhoto,
          },
        });
      }
    }

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      console.log("[PhotoUpload] Team not found:", teamId);
      return c.json({ error: { message: "Team not found", code: "TEAM_NOT_FOUND" } }, 404);
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      console.log("[PhotoUpload] Event not found:", eventId);
      return c.json({ error: { message: "Event not found", code: "EVENT_NOT_FOUND" } }, 404);
    }

    // Generate unique filename - handle cases where file.name might be undefined (React Native)
    let ext = "jpg";
    if (typeof fileData !== 'string' && (fileData as File).name && typeof (fileData as File).name === 'string') {
      const parts = (fileData as File).name.split(".");
      if (parts.length > 1) {
        ext = parts.pop() || "jpg";
      }
    }
    const filename = `${randomUUID()}.${ext}`;
    const filePath = join(UPLOADS_DIR, filename);

    // Save file - handle multiple input formats
    console.log("[PhotoUpload] File type:", typeof fileData, "constructor:", (fileData as any)?.constructor?.name);
    console.log("[PhotoUpload] File size:", (fileData as any)?.size);

    let fileBuffer: Buffer;
    try {
      if (typeof fileData === 'string') {
        // Handle string input - could be base64 data URI or file path
        if (fileData.startsWith('data:')) {
          // Base64 data URI (e.g., "data:image/jpeg;base64,/9j/4AAQ...")
          const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
          if (matches && matches[2]) {
            console.log("[PhotoUpload] Detected base64 data URI");
            fileBuffer = Buffer.from(matches[2], 'base64');
          } else {
            throw new Error('Invalid data URI format');
          }
        } else if (fileData.startsWith('file://') || fileData.startsWith('/')) {
          // File path - this shouldn't happen from mobile but handle it
          console.log("[PhotoUpload] Received file path instead of file data:", fileData.substring(0, 100));
          throw new Error('File paths are not supported. Please send the file data directly.');
        } else {
          // Try to parse as base64 directly (without data URI prefix)
          console.log("[PhotoUpload] Attempting to parse as raw base64");
          fileBuffer = Buffer.from(fileData, 'base64');
        }
      } else if (fileData && typeof (fileData as any).arrayBuffer === 'function') {
        // Standard File/Blob object with arrayBuffer method
        const arrayBuffer = await (fileData as any).arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else if (fileData && typeof (fileData as any).text === 'function') {
        // Fallback: read as text and convert
        const text = await (fileData as any).text();
        // Check if it's base64
        if (text.startsWith('data:')) {
          const matches = text.match(/^data:([^;]+);base64,(.+)$/);
          if (matches && matches[2]) {
            fileBuffer = Buffer.from(matches[2], 'base64');
          } else {
            fileBuffer = Buffer.from(text);
          }
        } else {
          fileBuffer = Buffer.from(text);
        }
      } else if (fileData && (fileData as any).size > 0) {
        // Try using Bun's native file reading
        const blob = fileData as Blob;
        const arrayBuffer = await blob.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else {
        throw new Error(`Unable to read file data. File type: ${typeof fileData}, size: ${(fileData as any)?.size}`);
      }
    } catch (readError) {
      console.error("[PhotoUpload] File read error:", readError);
      throw readError;
    }

    // Check if buffer is valid (at least a few bytes for a real image)
    if (fileBuffer.length < 100) {
      console.log("[PhotoUpload] Warning: Very small file received:", fileBuffer.length, "bytes");
    }

    console.log("[PhotoUpload] Buffer size:", fileBuffer.length);
    await writeFile(filePath, fileBuffer);

    // Create photo record
    const photo = await prisma.photo.create({
      data: {
        localId: localId || randomUUID(),
        teamId,
        eventId,
        storageKey: filename,
        storageUrl: `/uploads/${filename}`,
        overlayType,
        status: "available",
        syncedAt: new Date(),
      },
      include: {
        team: {
          select: { id: true, name: true, code: true },
        },
        event: {
          select: { id: true, venueName: true, venueCity: true, venueState: true, eventDate: true },
        },
      },
    });

    console.log("[PhotoUpload] Photo created successfully:", photo.id);

    // Return response format expected by mobile sync service
    return c.json({
      data: {
        success: true,
        localId: photo.localId,
        remoteUrl: photo.storageUrl,
        photo, // Include full photo object for backwards compatibility
      },
    }, 201);
  } catch (error) {
    console.error("[PhotoUpload] Error:", error);
    return c.json({ error: { message: "Internal server error", code: "INTERNAL_ERROR" } }, 500);
  }
});

// POST /api/photos/composite - Composite a photo with an overlay.
// Provide either an explicit overlayId, or an eventId (the event's assigned
// overlay is used). The overlay is resized to COVER the full photo dimensions
// regardless of the photo's orientation/aspect ratio.
const compositeSchema = z
  .object({
    photoUrl: z.string().url("Photo URL must be a valid URL"),
    overlayId: z.string().min(1).optional(),
    eventId: z.string().min(1).optional(),
  })
  .refine((d) => d.overlayId || d.eventId, {
    message: "Either overlayId or eventId is required",
  });

photosRouter.post(
  "/composite",
  zValidator("json", compositeSchema),
  async (c) => {
    const { photoUrl, overlayId, eventId } = c.req.valid("json");

    // Resolve the overlay id: explicit overlayId wins, else the event's overlay.
    let resolvedOverlayId = overlayId;
    if (!resolvedOverlayId && eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { overlayId: true },
      });
      if (!event) {
        return c.json(
          { error: { message: "Event not found", code: "EVENT_NOT_FOUND" } },
          404
        );
      }
      if (!event.overlayId) {
        return c.json(
          {
            error: {
              message: "Event has no overlay assigned",
              code: "EVENT_OVERLAY_NOT_SET",
            },
          },
          400
        );
      }
      resolvedOverlayId = event.overlayId;
    }

    // Fetch the overlay from database
    const overlay = await prisma.overlay.findUnique({
      where: { id: resolvedOverlayId! },
    });

    if (!overlay) {
      return c.json(
        { error: { message: "Overlay not found", code: "OVERLAY_NOT_FOUND" } },
        404
      );
    }

    if (!overlay.isActive) {
      return c.json(
        { error: { message: "Overlay is not active", code: "OVERLAY_INACTIVE" } },
        400
      );
    }

    try {
      // Fetch the original photo
      const photoResponse = await fetch(photoUrl);
      if (!photoResponse.ok) {
        return c.json(
          { error: { message: "Failed to fetch photo", code: "PHOTO_FETCH_FAILED" } },
          400
        );
      }
      const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());

      // Fetch the overlay image
      const overlayResponse = await fetch(overlay.url);
      if (!overlayResponse.ok) {
        return c.json(
          { error: { message: "Failed to fetch overlay", code: "OVERLAY_FETCH_FAILED" } },
          500
        );
      }
      const overlayBuffer = Buffer.from(await overlayResponse.arrayBuffer());

      // Get the dimensions of the original photo
      const photoMetadata = await sharp(photoBuffer).metadata();
      const photoWidth = photoMetadata.width || 1080;
      const photoHeight = photoMetadata.height || 1080;

      // Resize overlay to match photo dimensions
      const resizedOverlay = await sharp(overlayBuffer)
        .resize(photoWidth, photoHeight, {
          fit: "fill",
        })
        .toBuffer();

      // Composite the overlay on top of the photo
      const compositedImage = await sharp(photoBuffer)
        .composite([
          {
            input: resizedOverlay,
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer();

      // Upload the composited image to storage.vibecodeapp.com
      const filename = `composited-${randomUUID()}.png`;
      const blob = new Blob([compositedImage], { type: "image/png" });
      const file = new File([blob], filename, { type: "image/png" });

      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const uploadResponse = await fetch(
        "https://storage.vibecodeapp.com/v1/files/upload",
        {
          method: "POST",
          body: uploadFormData,
        }
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Storage upload failed:", errorText);
        return c.json(
          {
            error: {
              message: "Failed to upload composited image to storage",
              code: "STORAGE_UPLOAD_FAILED",
            },
          },
          500
        );
      }

      const uploadResult = (await uploadResponse.json()) as {
        file: {
          id: string;
          originalFilename: string;
          contentType: string;
          sizeBytes: number;
          url: string;
        };
      };

      return c.json({
        data: {
          compositedUrl: uploadResult.file.url,
          fileId: uploadResult.file.id,
          originalPhotoUrl: photoUrl,
          overlayId: overlay.id,
          overlayName: overlay.name,
        },
      });
    } catch (error) {
      console.error("Error compositing photo:", error);
      return c.json(
        {
          error: {
            message: "Internal server error during compositing",
            code: "INTERNAL_ERROR",
          },
        },
        500
      );
    }
  }
);

// DELETE /api/photos/purge/:eventId - Post-event bulk delete.
// Marks ALL not-yet-deleted photos for the event as "deleted" so the deletion
// propagates to the phone + both tablets (via GET /api/photos/deleted/... and
// the sync/status poll), and cleans up remote storage where applicable.
// Returns the count of photos purged.
photosRouter.delete("/purge/:eventId", async (c) => {
  const eventId = c.req.param("eventId");

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return c.json({ error: { message: "Event not found", code: "NOT_FOUND" } }, 404);
  }

  // Get all photos for the event that are not already deleted.
  const photos = await prisma.photo.findMany({
    where: { eventId, status: { not: "deleted" } },
  });

  // Clean up local files on disk and remote (finished) files in storage.
  for (const photo of photos) {
    if (photo.storageKey) {
      const filePath = join(UPLOADS_DIR, photo.storageKey);
      try {
        await unlink(filePath);
      } catch {
        // File might not exist, continue
      }
    }
    if (photo.finishedPhotoUrl) {
      await deleteFromRemoteStorage(photo.finishedPhotoUrl);
    }
  }

  // Mark photos deleted (keep storageKey so devices can locate local copies to
  // remove). deletedAt drives the deletion-propagation list.
  const now = new Date();
  const result = await prisma.photo.updateMany({
    where: { eventId, status: { not: "deleted" } },
    data: {
      status: "deleted",
      deletedAt: now,
    },
  });

  return c.json({ data: { purgedCount: result.count } });
});

// GET /api/photos/deleted/:teamId/:eventId - Deletion-propagation list.
// Returns photos marked "deleted" so each device (phone + both tablets) can
// remove its local file. Includes id, localId and storageKey to locate copies.
photosRouter.get("/deleted/:teamId/:eventId", async (c) => {
  const teamId = c.req.param("teamId");
  const eventId = c.req.param("eventId");

  const deleted = await prisma.photo.findMany({
    where: { teamId, eventId, status: "deleted" },
    select: {
      id: true,
      localId: true,
      storageKey: true,
      status: true,
      deletedAt: true,
    },
    orderBy: { deletedAt: "desc" },
  });

  return c.json({ data: { deleted } });
});

// GET /api/photos/:id - Get single photo (must be after specific routes)
photosRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: {
      team: {
        select: { id: true, name: true, code: true },
      },
      event: {
        select: { id: true, venueName: true, venueCity: true, venueState: true, eventDate: true },
      },
      pledges: {
        select: { id: true, email: true, emailStatus: true },
      },
    },
  });

  if (!photo) {
    return c.json({ error: { message: "Photo not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: photo });
});

// ==========================================
// Photo status state machine transitions
// ==========================================

const CONFLICT = 409 as const;

// PUT /api/photos/:id/select { deviceId } : available -> selected
// Atomic lock: only succeeds if the photo is currently "available", so two
// participants on the two tablets can never pick the same photo.
const selectSchema = z.object({
  deviceId: z.string().min(1, "deviceId is required"),
});

photosRouter.put("/:id/select", zValidator("json", selectSchema), async (c) => {
  const id = c.req.param("id");
  const { deviceId } = c.req.valid("json");

  const existing = await prisma.photo.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Photo not found", code: "NOT_FOUND" } }, 404);
  }

  // Conditional update prevents a race across the two tablets.
  const result = await prisma.photo.updateMany({
    where: { id, status: "available" },
    data: { status: "selected", selectedByDeviceId: deviceId },
  });

  if (result.count === 0) {
    return c.json(
      {
        error: {
          message: "Photo is no longer available (already selected)",
          code: "PHOTO_NOT_AVAILABLE",
        },
      },
      CONFLICT
    );
  }

  const photo = await prisma.photo.findUnique({ where: { id } });
  return c.json({ data: photo });
});

// PUT /api/photos/:id/release : selected|processing -> available
// Failure-retry / back-out path. A failed send MUST return the photo here.
photosRouter.put("/:id/release", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.photo.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Photo not found", code: "NOT_FOUND" } }, 404);
  }

  if (existing.status !== "selected" && existing.status !== "processing") {
    return c.json(
      {
        error: {
          message: `Cannot release a photo in status "${existing.status}"`,
          code: "INVALID_TRANSITION",
        },
      },
      CONFLICT
    );
  }

  const photo = await prisma.photo.update({
    where: { id },
    data: { status: "available", selectedByDeviceId: null },
  });

  return c.json({ data: photo });
});

// PUT /api/photos/:id/process { finishedPhotoUrl? } : selected -> processing
const processSchema = z.object({
  finishedPhotoUrl: z.string().url().optional(),
});

photosRouter.put("/:id/process", zValidator("json", processSchema), async (c) => {
  const id = c.req.param("id");
  const { finishedPhotoUrl } = c.req.valid("json");

  const existing = await prisma.photo.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Photo not found", code: "NOT_FOUND" } }, 404);
  }

  if (existing.status !== "selected") {
    return c.json(
      {
        error: {
          message: `Cannot process a photo in status "${existing.status}" (must be "selected")`,
          code: "INVALID_TRANSITION",
        },
      },
      CONFLICT
    );
  }

  const photo = await prisma.photo.update({
    where: { id },
    data: {
      status: "processing",
      ...(finishedPhotoUrl && { finishedPhotoUrl }),
    },
  });

  return c.json({ data: photo });
});

// PUT /api/photos/:id/sent { finishedPhotoUrl } : processing -> sent
// Deletion is a SEPARATE explicit step (/delete) done only after this succeeds.
const sentSchema = z.object({
  finishedPhotoUrl: z.string().url("finishedPhotoUrl is required"),
});

photosRouter.put("/:id/sent", zValidator("json", sentSchema), async (c) => {
  const id = c.req.param("id");
  const { finishedPhotoUrl } = c.req.valid("json");

  const existing = await prisma.photo.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Photo not found", code: "NOT_FOUND" } }, 404);
  }

  if (existing.status !== "processing") {
    return c.json(
      {
        error: {
          message: `Cannot mark sent a photo in status "${existing.status}" (must be "processing")`,
          code: "INVALID_TRANSITION",
        },
      },
      CONFLICT
    );
  }

  const now = new Date();
  const photo = await prisma.photo.update({
    where: { id },
    data: {
      status: "sent",
      finishedPhotoUrl,
      sentAt: now,
      usedAt: now,
    },
  });

  return c.json({ data: photo });
});

// PUT /api/photos/:id/delete : any -> deleted
// Explicit deletion. Appears in the deletion-propagation list so devices remove
// their local copies. Cleans up remote finished file best-effort.
photosRouter.put("/:id/delete", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.photo.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Photo not found", code: "NOT_FOUND" } }, 404);
  }

  if (existing.finishedPhotoUrl) {
    await deleteFromRemoteStorage(existing.finishedPhotoUrl);
  }
  if (existing.storageKey) {
    try {
      await unlink(join(UPLOADS_DIR, existing.storageKey));
    } catch {
      // ignore
    }
  }

  const photo = await prisma.photo.update({
    where: { id },
    data: { status: "deleted", deletedAt: new Date() },
  });

  return c.json({ data: photo });
});

// ==========================================
// Backwards-compat aliases (legacy claim/use).
// These now map onto the new state machine so old clients keep working:
//   /claim -> select (locks the photo). Requires deviceId; falls back to a
//             synthetic id if none supplied so legacy callers don't break.
//   /use   -> best-effort advance to "sent" (available->selected->processing->sent).
// ==========================================

photosRouter.put("/:id/claim", async (c) => {
  const id = c.req.param("id");

  let deviceId = "legacy";
  try {
    const body = (await c.req.json()) as { deviceId?: string };
    if (body?.deviceId) deviceId = body.deviceId;
  } catch {
    // no body
  }

  const existing = await prisma.photo.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Photo not found", code: "NOT_FOUND" } }, 404);
  }

  const result = await prisma.photo.updateMany({
    where: { id, status: "available" },
    data: { status: "selected", selectedByDeviceId: deviceId },
  });

  if (result.count === 0) {
    return c.json(
      {
        error: {
          message: "Photo is no longer available (already selected)",
          code: "PHOTO_NOT_AVAILABLE",
        },
      },
      CONFLICT
    );
  }

  const photo = await prisma.photo.findUnique({ where: { id } });
  return c.json({ data: photo });
});

photosRouter.put("/:id/use", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.photo.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Photo not found", code: "NOT_FOUND" } }, 404);
  }

  const now = new Date();
  const photo = await prisma.photo.update({
    where: { id },
    data: {
      status: "sent",
      sentAt: now,
      usedAt: now,
    },
  });

  return c.json({ data: photo });
});

export { photosRouter };
