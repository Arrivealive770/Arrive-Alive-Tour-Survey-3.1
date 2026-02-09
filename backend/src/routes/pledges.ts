import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const pledgesRouter = new Hono();

// GET /api/pledges - List pledges (filter by teamId, eventId, emailStatus)
pledgesRouter.get("/", async (c) => {
  const teamId = c.req.query("teamId");
  const eventId = c.req.query("eventId");
  const emailStatus = c.req.query("emailStatus");

  const pledges = await prisma.pledge.findMany({
    where: {
      ...(teamId && { teamId }),
      ...(eventId && { eventId }),
      ...(emailStatus && { emailStatus }),
    },
    include: {
      team: {
        select: { id: true, name: true, code: true },
      },
      event: {
        select: { id: true, venueName: true, venueCity: true, venueState: true, eventDate: true },
      },
      photo: {
        select: { id: true, storageUrl: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: pledges });
});

// POST /api/pledges - Create pledge (for sync)
const createPledgeSchema = z.object({
  localId: z.string().min(1, "Local ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  eventId: z.string().min(1, "Event ID is required"),
  email: z.string().email("Valid email is required"),
  surveyResponseId: z.string().optional(),
  photoId: z.string().optional(),
  createdAt: z.string().transform((str) => new Date(str)).optional(),
});

pledgesRouter.post(
  "/",
  zValidator("json", createPledgeSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Check for duplicate localId
    const existingPledge = await prisma.pledge.findUnique({
      where: { localId: data.localId },
    });

    if (existingPledge) {
      // Return existing pledge (idempotent)
      return c.json({ data: existingPledge });
    }

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
    });

    if (!team) {
      return c.json({ error: { message: "Team not found", code: "TEAM_NOT_FOUND" } }, 404);
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
    });

    if (!event) {
      return c.json({ error: { message: "Event not found", code: "EVENT_NOT_FOUND" } }, 404);
    }

    const pledge = await prisma.pledge.create({
      data: {
        localId: data.localId,
        teamId: data.teamId,
        eventId: data.eventId,
        email: data.email,
        surveyResponseId: data.surveyResponseId,
        photoId: data.photoId,
        emailStatus: "pending",
        createdAt: data.createdAt || new Date(),
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

    return c.json({ data: pledge }, 201);
  }
);

// PUT /api/pledges/:id/email-status - Update email status
const updateEmailStatusSchema = z.object({
  emailStatus: z.enum(["pending", "queued", "sent", "failed"]),
  emailError: z.string().optional(),
});

pledgesRouter.put(
  "/:id/email-status",
  zValidator("json", updateEmailStatusSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existingPledge = await prisma.pledge.findUnique({
      where: { id },
    });

    if (!existingPledge) {
      return c.json({ error: { message: "Pledge not found", code: "NOT_FOUND" } }, 404);
    }

    const pledge = await prisma.pledge.update({
      where: { id },
      data: {
        emailStatus: data.emailStatus,
        emailError: data.emailError,
        ...(data.emailStatus === "sent" && { emailSentAt: new Date() }),
      },
      include: {
        team: {
          select: { id: true, name: true, code: true },
        },
        event: {
          select: { id: true, venueName: true, venueCity: true, venueState: true, eventDate: true },
        },
        photo: {
          select: { id: true, storageUrl: true, status: true },
        },
      },
    });

    return c.json({ data: pledge });
  }
);

export { pledgesRouter };
