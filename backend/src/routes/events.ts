import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const eventsRouter = new Hono();

// GET /api/events - List events (filter by teamId, status query params)
eventsRouter.get("/", async (c) => {
  const teamId = c.req.query("teamId");
  const status = c.req.query("status");

  const events = await prisma.event.findMany({
    where: {
      ...(teamId && { teamId }),
      ...(status && { status }),
    },
    include: {
      team: {
        select: { id: true, name: true, code: true },
      },
      _count: {
        select: {
          surveyResponses: true,
          pledges: true,
          photos: true,
        },
      },
    },
    orderBy: { eventDate: "desc" },
  });

  // Parse surveyTypes JSON string to array
  const parsedEvents = events.map(event => ({
    ...event,
    surveyTypes: JSON.parse(event.surveyTypes),
  }));

  return c.json({ data: parsedEvents });
});

// GET /api/events/:id - Get event by ID
eventsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      team: true,
      overlay: true,
      _count: {
        select: {
          surveyResponses: true,
          pledges: true,
          photos: true,
        },
      },
    },
  });

  if (!event) {
    return c.json({ error: { message: "Event not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: event });
});

// GET /api/events/active/:teamId - Get active event for team
eventsRouter.get("/active/:teamId", async (c) => {
  const teamId = c.req.param("teamId");

  const event = await prisma.event.findFirst({
    where: {
      teamId,
      status: "active",
    },
    include: {
      team: {
        select: { id: true, name: true, code: true },
      },
      _count: {
        select: {
          surveyResponses: true,
          pledges: true,
          photos: true,
        },
      },
    },
    orderBy: { eventDate: "desc" },
  });

  if (!event) {
    return c.json({ error: { message: "No active event found for this team", code: "NO_ACTIVE_EVENT" } }, 404);
  }

  return c.json({ data: event });
});

// POST /api/events - Create event
const createEventSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  venueName: z.string().min(1, "Venue name is required"),
  venueCity: z.string().min(1, "Venue city is required"),
  venueState: z.string().min(1, "Venue state is required"),
  eventDate: z.string().transform((str) => new Date(str)),
  surveyTypes: z.array(z.string()).min(1, "At least one survey type is required"),
  overlayType: z.string().min(1, "Overlay type is required"),
  overlayId: z.string().min(1).optional(),
  picturePledgeEnabled: z.boolean().optional().default(false),
});

eventsRouter.post(
  "/",
  zValidator("json", createEventSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
    });

    if (!team) {
      return c.json({ error: { message: "Team not found", code: "TEAM_NOT_FOUND" } }, 404);
    }

    const event = await prisma.event.create({
      data: {
        teamId: data.teamId,
        venueName: data.venueName,
        venueCity: data.venueCity,
        venueState: data.venueState,
        eventDate: data.eventDate,
        surveyTypes: JSON.stringify(data.surveyTypes),
        overlayType: data.overlayType,
        ...(data.overlayId && { overlayId: data.overlayId }),
        picturePledgeEnabled: data.picturePledgeEnabled,
        status: "active",
      },
      include: {
        team: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return c.json({ data: event }, 201);
  }
);

// PUT /api/events/:id - Update event
const updateEventSchema = z.object({
  venueName: z.string().min(1).optional(),
  venueCity: z.string().min(1).optional(),
  venueState: z.string().min(1).optional(),
  eventDate: z.string().transform((str) => new Date(str)).optional(),
  surveyTypes: z.array(z.string()).optional(),
  overlayType: z.string().min(1).optional(),
  overlayId: z.string().min(1).nullable().optional(),
  picturePledgeEnabled: z.boolean().optional(),
  status: z.enum(["active", "completed"]).optional(),
});

eventsRouter.put(
  "/:id",
  zValidator("json", updateEventSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existingEvent = await prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      return c.json({ error: { message: "Event not found", code: "NOT_FOUND" } }, 404);
    }

    // If assigning an overlay, verify it exists.
    if (data.overlayId) {
      const overlay = await prisma.overlay.findUnique({
        where: { id: data.overlayId },
      });
      if (!overlay) {
        return c.json({ error: { message: "Overlay not found", code: "OVERLAY_NOT_FOUND" } }, 404);
      }
    }

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(data.venueName && { venueName: data.venueName }),
        ...(data.venueCity && { venueCity: data.venueCity }),
        ...(data.venueState && { venueState: data.venueState }),
        ...(data.eventDate && { eventDate: data.eventDate }),
        ...(data.surveyTypes && { surveyTypes: JSON.stringify(data.surveyTypes) }),
        ...(data.overlayType && { overlayType: data.overlayType }),
        // overlayId may be set to a string (assign) or null (clear).
        ...(data.overlayId !== undefined && { overlayId: data.overlayId }),
        ...(data.picturePledgeEnabled !== undefined && { picturePledgeEnabled: data.picturePledgeEnabled }),
        ...(data.status && { status: data.status }),
      },
      include: {
        team: {
          select: { id: true, name: true, code: true },
        },
        overlay: true,
      },
    });

    return c.json({ data: event });
  }
);

// POST /api/events/:id/overlay - Upload a custom overlay image and assign it to
// the event in one step (multipart/form-data: file, name?).
eventsRouter.post("/:id/overlay", async (c) => {
  const id = c.req.param("id");

  const existingEvent = await prisma.event.findUnique({ where: { id } });
  if (!existingEvent) {
    return c.json({ error: { message: "Event not found", code: "NOT_FOUND" } }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const nameRaw = formData.get("name") as string | null;

  if (!file) {
    return c.json({ error: { message: "File is required", code: "FILE_REQUIRED" } }, 400);
  }

  const validImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
  if (!validImageTypes.includes(file.type)) {
    return c.json(
      {
        error: {
          message: "Invalid file type. Only PNG, JPG, GIF, and WebP images are allowed.",
          code: "INVALID_FILE_TYPE",
        },
      },
      400
    );
  }

  try {
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    const uploadResponse = await fetch("https://storage.vibecodeapp.com/v1/files/upload", {
      method: "POST",
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      console.error("Storage upload failed:", await uploadResponse.text());
      return c.json(
        { error: { message: "Failed to upload file to storage", code: "STORAGE_UPLOAD_FAILED" } },
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

    const overlay = await prisma.overlay.create({
      data: {
        name: nameRaw?.trim() || `${existingEvent.venueName} overlay`,
        fileId: uploadResult.file.id,
        url: uploadResult.file.url,
        filename: uploadResult.file.originalFilename,
        contentType: uploadResult.file.contentType,
        sizeBytes: uploadResult.file.sizeBytes,
        isActive: true,
      },
    });

    const event = await prisma.event.update({
      where: { id },
      data: { overlayId: overlay.id },
      include: {
        team: { select: { id: true, name: true, code: true } },
        overlay: true,
      },
    });

    return c.json({ data: { event, overlay } }, 201);
  } catch (error) {
    console.error("Error uploading event overlay:", error);
    return c.json(
      { error: { message: "Internal server error during upload", code: "INTERNAL_ERROR" } },
      500
    );
  }
});

// PUT /api/events/:id/complete - Mark event completed
eventsRouter.put("/:id/complete", async (c) => {
  const id = c.req.param("id");

  const existingEvent = await prisma.event.findUnique({
    where: { id },
  });

  if (!existingEvent) {
    return c.json({ error: { message: "Event not found", code: "NOT_FOUND" } }, 404);
  }

  const event = await prisma.event.update({
    where: { id },
    data: {
      status: "completed",
    },
    include: {
      team: {
        select: { id: true, name: true, code: true },
      },
      _count: {
        select: {
          surveyResponses: true,
          pledges: true,
          photos: true,
        },
      },
    },
  });

  return c.json({ data: event });
});

export { eventsRouter };
