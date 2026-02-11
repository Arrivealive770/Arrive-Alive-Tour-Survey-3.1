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

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(data.venueName && { venueName: data.venueName }),
        ...(data.venueCity && { venueCity: data.venueCity }),
        ...(data.venueState && { venueState: data.venueState }),
        ...(data.eventDate && { eventDate: data.eventDate }),
        ...(data.surveyTypes && { surveyTypes: JSON.stringify(data.surveyTypes) }),
        ...(data.overlayType && { overlayType: data.overlayType }),
        ...(data.picturePledgeEnabled !== undefined && { picturePledgeEnabled: data.picturePledgeEnabled }),
        ...(data.status && { status: data.status }),
      },
      include: {
        team: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return c.json({ data: event });
  }
);

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
