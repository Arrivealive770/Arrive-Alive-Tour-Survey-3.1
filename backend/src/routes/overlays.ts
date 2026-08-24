import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import sharp from "sharp";
import {
  detectFrameWindow,
  detectMode,
  compositePhoto,
  windowFromOverlay,
  DEFAULT_WINDOW,
  type OverlayMode,
} from "../lib/overlay-frame";
import { storeFile, deleteStoredFile } from "../lib/file-storage";

const overlaysRouter = new Hono();

const VALID_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];
const VALID_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];

// iPhone photos are often HEIC. We can't decode or display those, so say so
// plainly instead of failing with a vague "invalid file type".
const HEIC_EXTENSIONS = ["heic", "heif"];

// Some clients (React Native's FormData in particular) send an empty or
// generic content type, so fall back to the filename extension before
// rejecting an otherwise fine JPG.
function isAllowedImage(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (VALID_IMAGE_TYPES.includes(type)) return true;
  if (type && type !== "application/octet-stream" && !type.startsWith("image/")) {
    return false;
  }
  const ext = (file.name || "").split(".").pop()?.toLowerCase() ?? "";
  return VALID_IMAGE_EXTENSIONS.includes(ext);
}

// GET /api/overlays - List all overlays
overlaysRouter.get("/", async (c) => {
  const isActive = c.req.query("isActive");

  const overlays = await prisma.overlay.findMany({
    where: {
      ...(isActive !== undefined && { isActive: isActive === "true" }),
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: overlays });
});

// GET /api/overlays/:id - Get single overlay
overlaysRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const overlay = await prisma.overlay.findUnique({
    where: { id },
  });

  if (!overlay) {
    return c.json({ error: { message: "Overlay not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: overlay });
});

// POST /api/overlays - Upload a new overlay
overlaysRouter.post("/", async (c) => {
  // Parsing can throw on its own (truncated upload, malformed multipart body).
  // Catch it here so the client gets a JSON reason rather than a bare 500.
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch (parseError) {
    console.error("[Overlay] Could not read the upload:", parseError);
    return c.json({
      error: {
        message:
          "Could not read the uploaded file. The upload may have been interrupted — check the connection and try again.",
        code: "FORM_PARSE_FAILED",
      },
    }, 400);
  }

  const rawFile = formData.get("file");
  const name = formData.get("name") as string | null;

  if (rawFile === null) {
    return c.json({ error: { message: "File is required", code: "FILE_REQUIRED" } }, 400);
  }

  // Some clients (React Native on web, mis-built form posts) send the file
  // descriptor as text instead of the actual file. Without this check it looks
  // like an invalid image, which sends people hunting the wrong problem.
  if (typeof rawFile === "string") {
    console.error("[Overlay] File field arrived as text, not a file:", rawFile.slice(0, 200));
    return c.json({
      error: {
        message:
          "The image didn't attach to the upload. Please pick the image again and retry.",
        code: "FILE_NOT_ATTACHED",
      },
    }, 400);
  }

  const file = rawFile as File;

  if (!name || name.trim().length === 0) {
    return c.json({ error: { message: "Name is required", code: "NAME_REQUIRED" } }, 400);
  }

  if (file.size === 0) {
    return c.json({
      error: {
        message: "That file is empty (0 bytes). Please pick the image again.",
        code: "FILE_EMPTY",
      },
    }, 400);
  }

  const extension = (file.name || "").split(".").pop()?.toLowerCase() ?? "";

  if (HEIC_EXTENSIONS.includes(extension) || (file.type || "").toLowerCase().includes("hei")) {
    return c.json({
      error: {
        message:
          "HEIC images (the iPhone photo format) aren't supported. Save or export the artwork as a PNG or JPG and upload that.",
        code: "HEIC_NOT_SUPPORTED",
      },
    }, 400);
  }

  // Validate file type - must be an image
  if (!isAllowedImage(file)) {
    return c.json({
      error: {
        message: `Invalid file type${
          extension ? ` (.${extension})` : file.type ? ` (${file.type})` : ""
        }. Only PNG, JPG, GIF, and WebP images are allowed.`,
        code: "INVALID_FILE_TYPE"
      }
    }, 400);
  }

  try {
    // Work out how this overlay should be applied. A JPG has no transparency,
    // so laying it on top would hide the photo entirely — it's a polaroid-style
    // frame instead, and we find the window the photo drops into. A PNG can be
    // either: a see-through hole ringed by solid artwork is also a frame.
    const requestedMode = (formData.get("mode") as string | null)?.trim();
    let mode = requestedMode === "overlay" || requestedMode === "frame" ? requestedMode : "auto";
    let window: { x: number; y: number; w: number; h: number } | null = null;

    // Read the bytes once: both the mode probe and the save below need them,
    // and a File can only be streamed a single time.
    const imageBuffer = Buffer.from(await file.arrayBuffer());

    try {
      if (mode === "auto") {
        mode = await detectMode(imageBuffer);
        console.log(`[Overlay] Auto-detected "${file.name}" as ${mode} mode`);
      }
      if (mode === "frame") {
        window = await detectFrameWindow(imageBuffer);
      }
    } catch (inspectError) {
      console.error("[Overlay] Could not inspect image, using defaults:", inspectError);
      if (mode === "frame") window = DEFAULT_WINDOW;
    }

    // Saved to the server's own uploads folder. See lib/file-storage.ts for
    // why this no longer goes out to Vibecode's storage service.
    const stored = await storeFile({
      buffer: imageBuffer,
      preferredName: file.name,
      contentType: file.type,
    });

    // Save overlay info to database
    const overlay = await prisma.overlay.create({
      data: {
        name: name.trim(),
        fileId: stored.id,
        url: stored.url,
        filename: stored.originalFilename,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        isActive: true,
        mode,
        ...(window && {
          windowX: window.x,
          windowY: window.y,
          windowW: window.w,
          windowH: window.h,
        }),
      },
    });

    return c.json({ data: overlay }, 201);
  } catch (error) {
    console.error("Error uploading overlay:", error);
    return c.json({
      error: {
        message: `Upload failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        code: "INTERNAL_ERROR"
      }
    }, 500);
  }
});

// PUT /api/overlays/:id - Update overlay (name, isActive, frame window)
overlaysRouter.put(
  "/:id",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
      mode: z.enum(["auto", "overlay", "frame"]).optional(),
      // Window rect as fractions of the frame image.
      windowX: z.number().min(0).max(1).optional(),
      windowY: z.number().min(0).max(1).optional(),
      windowW: z.number().min(0.01).max(1).optional(),
      windowH: z.number().min(0.01).max(1).optional(),
    })
  ),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const existingOverlay = await prisma.overlay.findUnique({
      where: { id },
    });

    if (!existingOverlay) {
      return c.json({ error: { message: "Overlay not found", code: "NOT_FOUND" } }, 404);
    }

    const overlay = await prisma.overlay.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.mode !== undefined && { mode: body.mode }),
        ...(body.windowX !== undefined && { windowX: body.windowX }),
        ...(body.windowY !== undefined && { windowY: body.windowY }),
        ...(body.windowW !== undefined && { windowW: body.windowW }),
        ...(body.windowH !== undefined && { windowH: body.windowH }),
      },
    });

    return c.json({ data: overlay });
  }
);

// POST /api/overlays/:id/redetect-window - Re-run window detection on the
// stored frame image. Handy after swapping artwork or for overlays uploaded
// before frame support existed.
overlaysRouter.post("/:id/redetect-window", async (c) => {
  const id = c.req.param("id");

  const existingOverlay = await prisma.overlay.findUnique({ where: { id } });
  if (!existingOverlay) {
    return c.json({ error: { message: "Overlay not found", code: "NOT_FOUND" } }, 404);
  }

  try {
    const response = await fetch(existingOverlay.url);
    if (!response.ok) {
      return c.json(
        { error: { message: "Could not fetch overlay image", code: "OVERLAY_FETCH_FAILED" } },
        502
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const window = await detectFrameWindow(buffer);

    const overlay = await prisma.overlay.update({
      where: { id },
      data: {
        windowX: window.x,
        windowY: window.y,
        windowW: window.w,
        windowH: window.h,
      },
    });

    return c.json({ data: overlay });
  } catch (error) {
    console.error("[Overlay] Window re-detection failed:", error);
    return c.json(
      { error: { message: "Window detection failed", code: "INTERNAL_ERROR" } },
      500
    );
  }
});

// GET /api/overlays/:id/preview - Returns a PNG showing how a pledge photo will
// come out with this overlay, so the frame window can be checked before an
// event. Optional ?photoUrl= uses a real photo instead of the stand-in.
overlaysRouter.get("/:id/preview", async (c) => {
  const id = c.req.param("id");

  const overlay = await prisma.overlay.findUnique({ where: { id } });
  if (!overlay) {
    return c.json({ error: { message: "Overlay not found", code: "NOT_FOUND" } }, 404);
  }

  try {
    const overlayResponse = await fetch(overlay.url);
    if (!overlayResponse.ok) {
      return c.json(
        { error: { message: "Could not fetch overlay image", code: "OVERLAY_FETCH_FAILED" } },
        502
      );
    }
    const overlayBuffer = Buffer.from(await overlayResponse.arrayBuffer());

    // Stand-in photo: portrait, obviously fake, with an off-centre marker so
    // it's clear which part of the photo the window keeps.
    const photoUrl = c.req.query("photoUrl");
    let photoBuffer: Buffer;
    if (photoUrl) {
      const photoResponse = await fetch(photoUrl);
      if (!photoResponse.ok) {
        return c.json(
          { error: { message: "Could not fetch photo", code: "PHOTO_FETCH_FAILED" } },
          400
        );
      }
      photoBuffer = Buffer.from(await photoResponse.arrayBuffer());
    } else {
      const sample = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#0f172a"/>
        </linearGradient></defs>
        <rect width="1080" height="1440" fill="url(#g)"/>
        <circle cx="540" cy="520" r="180" fill="#ffffff" opacity="0.9"/>
        <rect x="300" y="760" width="480" height="520" rx="240" fill="#ffffff" opacity="0.9"/>
        <text x="540" y="1390" font-family="sans-serif" font-size="56" fill="#ffffff"
              text-anchor="middle" opacity="0.8">SAMPLE PHOTO</text>
      </svg>`;
      photoBuffer = await sharp(Buffer.from(sample)).png().toBuffer();
    }

    const { buffer } = await compositePhoto({
      photoBuffer,
      overlayBuffer,
      mode: (overlay.mode as OverlayMode) ?? "auto",
      window: windowFromOverlay(overlay),
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Overlay] Preview failed:", error);
    return c.json(
      { error: { message: "Preview failed", code: "INTERNAL_ERROR" } },
      500
    );
  }
});

// DELETE /api/overlays/:id - Delete an overlay
overlaysRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existingOverlay = await prisma.overlay.findUnique({
    where: { id },
  });

  if (!existingOverlay) {
    return c.json({ error: { message: "Overlay not found", code: "NOT_FOUND" } }, 404);
  }

  // Remove the artwork from disk. Best-effort by design: the overlay record
  // goes either way, so a file that is already missing never blocks a delete.
  // Overlays uploaded before the move to local storage have a remote URL and
  // no local file; those are simply skipped.
  await deleteStoredFile(existingOverlay.fileId);

  // Delete from database
  await prisma.overlay.delete({
    where: { id },
  });

  return c.json({ data: { success: true, id } });
});

export { overlaysRouter };
