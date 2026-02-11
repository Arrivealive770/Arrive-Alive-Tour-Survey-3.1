import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const overlaysRouter = new Hono();

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
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;

  if (!file) {
    return c.json({ error: { message: "File is required", code: "FILE_REQUIRED" } }, 400);
  }

  if (!name || name.trim().length === 0) {
    return c.json({ error: { message: "Name is required", code: "NAME_REQUIRED" } }, 400);
  }

  // Validate file type - must be an image
  const validImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
  if (!validImageTypes.includes(file.type)) {
    return c.json({
      error: {
        message: "Invalid file type. Only PNG, JPG, GIF, and WebP images are allowed.",
        code: "INVALID_FILE_TYPE"
      }
    }, 400);
  }

  try {
    // Upload to storage.vibecodeapp.com
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    const uploadResponse = await fetch("https://storage.vibecodeapp.com/v1/files/upload", {
      method: "POST",
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Storage upload failed:", errorText);
      return c.json({
        error: {
          message: "Failed to upload file to storage",
          code: "STORAGE_UPLOAD_FAILED"
        }
      }, 500);
    }

    const uploadResult = await uploadResponse.json() as {
      file: {
        id: string;
        originalFilename: string;
        contentType: string;
        sizeBytes: number;
        url: string;
      };
    };

    // Save overlay info to database
    const overlay = await prisma.overlay.create({
      data: {
        name: name.trim(),
        fileId: uploadResult.file.id,
        url: uploadResult.file.url,
        filename: uploadResult.file.originalFilename,
        contentType: uploadResult.file.contentType,
        sizeBytes: uploadResult.file.sizeBytes,
        isActive: true,
      },
    });

    return c.json({ data: overlay }, 201);
  } catch (error) {
    console.error("Error uploading overlay:", error);
    return c.json({
      error: {
        message: "Internal server error during upload",
        code: "INTERNAL_ERROR"
      }
    }, 500);
  }
});

// PUT /api/overlays/:id - Update overlay (name, isActive)
overlaysRouter.put(
  "/:id",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
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
      },
    });

    return c.json({ data: overlay });
  }
);

// DELETE /api/overlays/:id - Delete an overlay
overlaysRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existingOverlay = await prisma.overlay.findUnique({
    where: { id },
  });

  if (!existingOverlay) {
    return c.json({ error: { message: "Overlay not found", code: "NOT_FOUND" } }, 404);
  }

  try {
    // Delete from storage.vibecodeapp.com
    const deleteResponse = await fetch(`https://storage.vibecodeapp.com/v1/files/${existingOverlay.fileId}`, {
      method: "DELETE",
    });

    if (!deleteResponse.ok) {
      console.error("Failed to delete file from storage:", await deleteResponse.text());
      // Continue with database deletion even if storage deletion fails
    }
  } catch (error) {
    console.error("Error deleting from storage:", error);
    // Continue with database deletion even if storage deletion fails
  }

  // Delete from database
  await prisma.overlay.delete({
    where: { id },
  });

  return c.json({ data: { success: true, id } });
});

export { overlaysRouter };
