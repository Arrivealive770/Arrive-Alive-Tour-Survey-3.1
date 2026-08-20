import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const surveysRouter = new Hono();

/**
 * How a question is answered on the kiosk.
 * - single_choice: pick exactly one option; the kiosk auto-advances.
 * - multi_select:  multiple choice; pick any number of options and press
 *                  Continue. The stored answer is an array of option labels.
 */
const ANSWER_TYPES = z.enum(["single_choice", "multi_select"]);

/**
 * Normalise one stored answer into the list of options it selected.
 *
 * A single-choice answer is a string; a multi-select answer is an array. Older
 * app builds joined multi answers with ", " before sending, so that shape is
 * accepted too — otherwise those responses would silently count as zero.
 */
function selectedOptions(answer: unknown, options: string[]): string[] {
  if (Array.isArray(answer)) {
    return answer.map((value) => String(value));
  }
  if (typeof answer !== "string" || answer === "") {
    return [];
  }
  if (options.includes(answer)) {
    return [answer];
  }
  // Not a known option on its own — it may be a legacy joined multi-answer.
  const parts = answer.split(", ").map((part) => part.trim());
  return parts.length > 1 && parts.every((part) => options.includes(part)) ? parts : [answer];
}

// GET /api/surveys/types - List all survey types with questions
surveysRouter.get("/types", async (c) => {
  const includeInactive = c.req.query("includeInactive") === "true";

  const surveyTypes = await prisma.surveyType.findMany({
    where: includeInactive ? {} : { isActive: true },
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

// POST /api/surveys/types - Create a new survey type
const createSurveyTypeSchema = z.object({
  slug: z.string().min(1, "Slug is required").max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  questions: z.array(z.object({
    orderIndex: z.number().int().min(1),
    questionText: z.string().min(1, "Question text is required"),
    answerType: ANSWER_TYPES.default("single_choice"),
    options: z.array(z.string()).min(2, "At least 2 options required"),
    isRequired: z.boolean().default(true),
  })).optional(),
});

surveysRouter.post(
  "/types",
  zValidator("json", createSurveyTypeSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Check if slug already exists
    const existingType = await prisma.surveyType.findUnique({
      where: { slug: data.slug },
    });

    if (existingType) {
      return c.json({ error: { message: "Survey type with this slug already exists", code: "SLUG_EXISTS" } }, 400);
    }

    // Create survey type with questions in a transaction
    const surveyType = await prisma.$transaction(async (tx) => {
      const newType = await tx.surveyType.create({
        data: {
          slug: data.slug,
          name: data.name,
          description: data.description,
          isActive: true,
        },
      });

      // Create questions if provided
      if (data.questions && data.questions.length > 0) {
        await tx.surveyQuestion.createMany({
          data: data.questions.map((q) => ({
            surveyTypeId: newType.id,
            orderIndex: q.orderIndex,
            questionText: q.questionText,
            answerType: q.answerType,
            options: JSON.stringify(q.options),
            isRequired: q.isRequired,
          })),
        });
      }

      return tx.surveyType.findUnique({
        where: { id: newType.id },
        include: {
          questions: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });
    });

    if (!surveyType) {
      return c.json({ error: { message: "Failed to create survey type", code: "CREATE_FAILED" } }, 500);
    }

    // Parse JSON options for response
    const parsedType = {
      ...surveyType,
      questions: surveyType.questions.map((q) => ({
        ...q,
        options: JSON.parse(q.options),
      })),
    };

    return c.json({ data: parsedType }, 201);
  }
);

// PUT /api/surveys/types/:slug - Update a survey type
const updateSurveyTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  questions: z.array(z.object({
    id: z.string().optional(), // If provided, update existing question
    orderIndex: z.number().int().min(1),
    questionText: z.string().min(1, "Question text is required"),
    answerType: ANSWER_TYPES.default("single_choice"),
    options: z.array(z.string()).min(2, "At least 2 options required"),
    isRequired: z.boolean().default(true),
  })).optional(),
});

surveysRouter.put(
  "/types/:slug",
  zValidator("json", updateSurveyTypeSchema),
  async (c) => {
    const slug = c.req.param("slug");
    const data = c.req.valid("json");

    const existingType = await prisma.surveyType.findUnique({
      where: { slug },
    });

    if (!existingType) {
      return c.json({ error: { message: "Survey type not found", code: "NOT_FOUND" } }, 404);
    }

    // Update survey type and questions in a transaction
    const surveyType = await prisma.$transaction(async (tx) => {
      // Update basic fields
      await tx.surveyType.update({
        where: { slug },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      // Update questions if provided
      if (data.questions) {
        // Delete existing questions and recreate
        await tx.surveyQuestion.deleteMany({
          where: { surveyTypeId: existingType.id },
        });

        await tx.surveyQuestion.createMany({
          data: data.questions.map((q) => ({
            surveyTypeId: existingType.id,
            orderIndex: q.orderIndex,
            questionText: q.questionText,
            answerType: q.answerType,
            options: JSON.stringify(q.options),
            isRequired: q.isRequired,
          })),
        });
      }

      return tx.surveyType.findUnique({
        where: { slug },
        include: {
          questions: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });
    });

    if (!surveyType) {
      return c.json({ error: { message: "Failed to update survey type", code: "UPDATE_FAILED" } }, 500);
    }

    // Parse JSON options for response
    const parsedType = {
      ...surveyType,
      questions: surveyType.questions.map((q) => ({
        ...q,
        options: JSON.parse(q.options),
      })),
    };

    return c.json({ data: parsedType });
  }
);

// DELETE /api/surveys/types/:slug - Delete a survey type (soft delete by setting isActive = false)
surveysRouter.delete("/types/:slug", async (c) => {
  const slug = c.req.param("slug");
  const hardDelete = c.req.query("hard") === "true";

  const existingType = await prisma.surveyType.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { questions: true },
      },
    },
  });

  if (!existingType) {
    return c.json({ error: { message: "Survey type not found", code: "NOT_FOUND" } }, 404);
  }

  // Check if there are any survey responses using this type
  const responseCount = await prisma.surveyResponse.count({
    where: { surveyTypeSlug: slug },
  });

  if (hardDelete) {
    if (responseCount > 0) {
      return c.json({
        error: {
          message: `Cannot delete survey type with ${responseCount} existing responses. Use soft delete instead.`,
          code: "HAS_RESPONSES"
        }
      }, 400);
    }

    // Hard delete - remove questions and survey type
    await prisma.$transaction(async (tx) => {
      await tx.surveyQuestion.deleteMany({
        where: { surveyTypeId: existingType.id },
      });
      await tx.surveyType.delete({
        where: { slug },
      });
    });

    return c.json({ data: { deleted: true, slug } });
  } else {
    // Soft delete - just mark as inactive
    await prisma.surveyType.update({
      where: { slug },
      data: { isActive: false },
    });

    return c.json({ data: { deleted: false, deactivated: true, slug, responseCount } });
  }
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

// GET /api/surveys/results/:slug - Get aggregated survey results for pie charts
surveysRouter.get("/results/:slug", async (c) => {
  const slug = c.req.param("slug");
  const teamId = c.req.query("teamId");
  const eventId = c.req.query("eventId");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  // Get the survey type with questions
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

  // Get all responses for this survey type
  const responses = await prisma.surveyResponse.findMany({
    where: {
      surveyTypeSlug: slug,
      ...(teamId && { teamId }),
      ...(eventId && { eventId }),
      ...(startDate || endDate
        ? {
            completedAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    },
  });

  // Aggregate responses by question
  const questionResults = surveyType.questions.map((question) => {
    const options = JSON.parse(question.options) as string[];

    // Count responses for each option
    const optionCounts: Record<string, number> = {};
    options.forEach((opt) => {
      optionCounts[opt] = 0;
    });

    // Number of PEOPLE who answered this question. For single choice that is
    // the same as the sum of the counts; for multi select it is not, and
    // percentages must be out of respondents or they add up past 100%.
    let respondentCount = 0;

    responses.forEach((response) => {
      const answers = JSON.parse(response.responses) as Record<string, unknown>;
      const questionKey = `q${question.orderIndex}`;
      const picked = selectedOptions(answers[questionKey], options);

      let counted = false;
      picked.forEach((choice) => {
        if (optionCounts[choice] !== undefined) {
          optionCounts[choice]++;
          counted = true;
        }
      });

      if (counted) respondentCount++;
    });

    const totalResponses = respondentCount;

    return {
      questionId: question.id,
      orderIndex: question.orderIndex,
      questionText: question.questionText,
      totalResponses,
      options: options.map((opt, index) => ({
        label: opt,
        count: optionCounts[opt] || 0,
        percentage: totalResponses > 0
          ? Math.round((optionCounts[opt] || 0) / totalResponses * 100)
          : 0,
      })),
    };
  });

  return c.json({
    data: {
      surveyType: {
        id: surveyType.id,
        slug: surveyType.slug,
        name: surveyType.name,
        description: surveyType.description,
      },
      totalResponses: responses.length,
      questionResults,
    },
  });
});

export { surveysRouter };
