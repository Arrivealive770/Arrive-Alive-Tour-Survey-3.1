import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const surveysRouter = new Hono();

// GET /api/surveys/types - List all survey types with questions
surveysRouter.get("/types", async (c) => {
  const surveyTypes = await prisma.surveyType.findMany({
    where: { isActive: true },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Parse JSON options for each question
  const parsedTypes = surveyTypes.map((type) => ({
    ...type,
    questions: type.questions.map((q) => ({
      ...q,
      options: JSON.parse(q.options),
    })),
  }));

  return c.json({ data: parsedTypes });
});

// GET /api/surveys/types/:slug - Get single survey type with questions
surveysRouter.get("/types/:slug", async (c) => {
  const slug = c.req.param("slug");

  const surveyType = await prisma.surveyType.findUnique({
    where: { slug },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!surveyType) {
    return c.json({ error: { message: "Survey type not found", code: "NOT_FOUND" } }, 404);
  }

  // Parse JSON options for each question
  const parsedType = {
    ...surveyType,
    questions: surveyType.questions.map((q) => ({
      ...q,
      options: JSON.parse(q.options),
    })),
  };

  return c.json({ data: parsedType });
});

// GET /api/surveys/responses - List responses (filter by teamId, eventId, surveyTypeSlug, dateRange)
surveysRouter.get("/responses", async (c) => {
  const teamId = c.req.query("teamId");
  const eventId = c.req.query("eventId");
  const surveyTypeSlug = c.req.query("surveyTypeSlug");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  const responses = await prisma.surveyResponse.findMany({
    where: {
      ...(teamId && { teamId }),
      ...(eventId && { eventId }),
      ...(surveyTypeSlug && { surveyTypeSlug }),
      ...(startDate || endDate
        ? {
            completedAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    },
    include: {
      team: {
        select: { id: true, name: true, code: true },
      },
      event: {
        select: { id: true, venueName: true, venueCity: true, venueState: true, eventDate: true },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  // Parse JSON responses
  const parsedResponses = responses.map((r) => ({
    ...r,
    responses: JSON.parse(r.responses),
  }));

  return c.json({ data: parsedResponses });
});

// POST /api/surveys/responses - Create survey response (for sync)
const createSurveyResponseSchema = z.object({
  localId: z.string().min(1, "Local ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  eventId: z.string().min(1, "Event ID is required"),
  surveyTypeSlug: z.string().min(1, "Survey type slug is required"),
  responses: z.record(z.string(), z.any()),
  ageRange: z.string().optional(),
  deviceId: z.string().optional(),
  completedAt: z.string().transform((str) => new Date(str)).optional(),
  durationSeconds: z.number().int().positive().optional(),
});

surveysRouter.post(
  "/responses",
  zValidator("json", createSurveyResponseSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Check for duplicate localId
    const existingResponse = await prisma.surveyResponse.findUnique({
      where: { localId: data.localId },
    });

    if (existingResponse) {
      // Return existing response (idempotent)
      return c.json({
        data: {
          ...existingResponse,
          responses: JSON.parse(existingResponse.responses),
        },
      });
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

    const surveyResponse = await prisma.surveyResponse.create({
      data: {
        localId: data.localId,
        teamId: data.teamId,
        eventId: data.eventId,
        surveyTypeSlug: data.surveyTypeSlug,
        responses: JSON.stringify(data.responses),
        ageRange: data.ageRange,
        deviceId: data.deviceId,
        completedAt: data.completedAt || new Date(),
        durationSeconds: data.durationSeconds,
        syncedAt: new Date(),
      },
    });

    return c.json({
      data: {
        ...surveyResponse,
        responses: JSON.parse(surveyResponse.responses),
      },
    }, 201);
  }
);

export { surveysRouter };
