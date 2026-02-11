import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { mkdir, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

const photosRouter = new Hono();

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

// GET /api/photos/:id - Get single photo
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

// POST /api/photos/upload - Upload photo (multipart/form-data with file, teamId, eventId, overlayType)
photosRouter.post("/upload", async (c) => {
  await ensureUploadsDir();

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const teamId = formData.get("teamId") as string | null;
  const eventId = formData.get("eventId") as string | null;
  const overlayType = formData.get("overlayType") as string | null;
  const localId = formData.get("localId") as string | null;

  if (!file) {
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
      return c.json({ data: existingPhoto });
    }
  }

  // Verify team exists
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    return c.json({ error: { message: "Team not found", code: "TEAM_NOT_FOUND" } }, 404);
  }

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return c.json({ error: { message: "Event not found", code: "EVENT_NOT_FOUND" } }, 404);
  }

  // Generate unique filename
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const filePath = join(UPLOADS_DIR, filename);

  // Save file
  const buffer = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(buffer));

  // Create photo record
  const photo = await prisma.photo.create({
    data: {
      localId: localId || randomUUID(),
      teamId,
      eventId,
      storageKey: filename,
      storageUrl: `/uploads/${filename}`,
      overlayType,
      status: "uploaded",
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

  return c.json({ data: photo }, 201);
});

// PUT /api/photos/:id/claim - Mark photo as claimed
photosRouter.put("/:id/claim", async (c) => {
  const id = c.req.param("id");

  const existingPhoto = await prisma.photo.findUnique({
    where: { id },
  });

  if (!existingPhoto) {
    return c.json({ error: { message: "Photo not found", code: "NOT_FOUND" } }, 404);
  }

  const photo = await prisma.photo.update({
    where: { id },
    data: {
      status: "used",
      usedAt: new Date(),
    },
  });

  return c.json({ data: photo });
});

// PUT /api/photos/:id/use - Mark photo as used
photosRouter.put("/:id/use", async (c) => {
  const id = c.req.param("id");

  const existingPhoto = await prisma.photo.findUnique({
    where: { id },
  });

  if (!existingPhoto) {
    return c.json({ error: { message: "Photo not found", code: "NOT_FOUND" } }, 404);
  }

  const photo = await prisma.photo.update({
    where: { id },
    data: {
      status: "used",
      usedAt: new Date(),
    },
  });

  return c.json({ data: photo });
});

// DELETE /api/photos/purge/:eventId - Purge all photos for event
photosRouter.delete("/purge/:eventId", async (c) => {
  const eventId = c.req.param("eventId");

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return c.json({ error: { message: "Event not found", code: "NOT_FOUND" } }, 404);
  }

  // Get all photos for the event
  const photos = await prisma.photo.findMany({
    where: { eventId },
  });

  // Delete files from disk
  for (const photo of photos) {
    if (photo.storageKey) {
      const filePath = join(UPLOADS_DIR, photo.storageKey);
      try {
        await unlink(filePath);
      } catch (error) {
        // File might not exist, continue
      }
    }
  }

  // Update photos to purged status
  const result = await prisma.photo.updateMany({
    where: { eventId },
    data: {
      status: "purged",
      storageKey: null,
      storageUrl: null,
    },
  });

  return c.json({ data: { purgedCount: result.count } });
});

// POST /api/photos/composite - Composite a photo with an overlay
const compositeSchema = z.object({
  photoUrl: z.string().url("Photo URL must be a valid URL"),
  overlayId: z.string().min(1, "Overlay ID is required"),
});

photosRouter.post(
  "/composite",
  zValidator("json", compositeSchema),
  async (c) => {
    const { photoUrl, overlayId } = c.req.valid("json");

    // Fetch the overlay from database
    const overlay = await prisma.overlay.findUnique({
      where: { id: overlayId },
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

export { photosRouter };
