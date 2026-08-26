import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { csvResponse, timestampedFilename } from "../lib/csv";

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
 *
 * Older builds again sent the whole session object per question —
 * { questionId, answer, answeredAt } — rather than the answer alone, so the
 * answer is unwrapped when it arrives wrapped.
 */
function selectedOptions(answer: unknown, options: string[]): string[] {
  if (answer && typeof answer === "object" && !Array.isArray(answer) && "answer" in answer) {
    return selectedOptions((answer as { answer: unknown }).answer, options);
  }
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

/** The shape of a question as far as counting is concerned. */
interface CountableQuestion {
  id: string;
  orderIndex: number;
  questionText: string;
  options: string;
}

/**
 * Tally answers per question.
 *
 * Shared by the pie chart endpoint and the spreadsheet export so the two can
 * never disagree: a report and a download that put different numbers against
 * the same question is worse than having neither.
 */
function tallyQuestions(
  questions: CountableQuestion[],
  responses: { responses: string }[]
) {
  return questions.map((question) => {
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
      options: options.map((opt) => ({
        label: opt,
        count: optionCounts[opt] || 0,
        percentage: totalResponses > 0
          ? Math.round((optionCounts[opt] || 0) / totalResponses * 100)
          : 0,
      })),
    };
  });
}

/**
 * The response filter shared by every read endpoint.
 *
 * `eventIds` takes a comma separated list because the Data tab lets staff tick
 * any number of events; `eventId` stays supported for the single-event callers
 * that were written first.
 */
function responseFilter(query: Record<string, string | undefined>) {
  const { teamId, eventId, surveyTypeSlug, startDate, endDate } = query;

  const eventIds = (query.eventIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    ...(teamId && { teamId }),
    ...(eventIds.length > 0
      ? { eventId: { in: eventIds } }
      : eventId
        ? { eventId }
        : {}),
    ...(surveyTypeSlug && { surveyTypeSlug }),
    ...(startDate || endDate
      ? {
          completedAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
      : {}),
  };
}

/** Every filter the export endpoints read off the query string. */
function exportQuery(c: { req: { query: (key: string) => string | undefined } }) {
  return {
    teamId: c.req.query("teamId"),
    eventId: c.req.query("eventId"),
    eventIds: c.req.query("eventIds"),
    surveyTypeSlug: c.req.query("surveyTypeSlug"),
    startDate: c.req.query("startDate"),
    endDate: c.req.query("endDate"),
  };
}

/** "Riverside High — Austin, TX (Mar 4, 2026)" for a spreadsheet cell. */
function describeEvent(event: {
  venueName: string;
  venueCity: string | null;
  venueState: string | null;
} | null): string {
  if (!event) return "";
  const place = [event.venueCity, event.venueState].filter(Boolean).join(", ");
  return place ? `${event.venueName} — ${place}` : event.venueName;
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
  const responses = await prisma.surveyResponse.findMany({
    where: responseFilter(exportQuery(c)),
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
      ...responseFilter(exportQuery(c)),
      surveyTypeSlug: slug,
    },
  });

  // Aggregate responses by question
  const questionResults = tallyQuestions(surveyType.questions, responses);

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

/**
 * Spreadsheet exports for the Data tab.
 *
 * The pie chart report answers "what does this look like on a slide". These
 * answer "give me the numbers so I can work with them" — sponsors and school
 * districts ask for the underlying data, and until now the only way to hand it
 * over was to read it off the screen.
 *
 * CSV rather than xlsx: it opens natively in Excel, Sheets and Numbers, and it
 * needs no dependency to produce. Both endpoints take the same filters as the
 * rest of this router, so a download always matches what the tab is showing.
 *
 * These return text/csv, which api-patterns.md exempts from the { data } envelope.
 */

/** Timestamps as "2026-08-25 14:30", which every spreadsheet parses as a date. */
function utcTimestamp(value: Date | null): string {
  if (!value) return "";
  return `${value.toISOString().slice(0, 10)} ${value.toISOString().slice(11, 16)}`;
}

/** Dates as "2026-08-25". */
function utcDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

// GET /api/surveys/export/summary.csv - Aggregated answers, the pie chart numbers
surveysRouter.get("/export/summary.csv", async (c) => {
  const filter = responseFilter(exportQuery(c));

  const [surveyTypes, responses] = await Promise.all([
    prisma.surveyType.findMany({
      include: { questions: { orderBy: { orderIndex: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.surveyResponse.findMany({ where: filter }),
  ]);

  const rows: unknown[][] = [[
    "Survey Type",
    "Question #",
    "Question",
    "Answer",
    "Responses",
    "% of People Who Answered",
    "People Who Answered",
    "Total Surveys Taken",
  ]];

  for (const surveyType of surveyTypes) {
    const forType = responses.filter((r) => r.surveyTypeSlug === surveyType.slug);

    // A type nobody answered inside the current filters would only add rows of
    // zeroes, which reads as "we asked and got nothing" rather than "this was
    // not part of the selection".
    if (forType.length === 0) continue;

    for (const question of tallyQuestions(surveyType.questions, forType)) {
      for (const option of question.options) {
        rows.push([
          surveyType.name,
          question.orderIndex,
          question.questionText,
          option.label,
          option.count,
          `${option.percentage}%`,
          question.totalResponses,
          forType.length,
        ]);
      }
    }
  }

  return csvResponse(timestampedFilename("survey-summary", new Date()), rows);
});

// GET /api/surveys/export/responses.csv - One row per survey taken
surveysRouter.get("/export/responses.csv", async (c) => {
  const filter = responseFilter(exportQuery(c));

  const [surveyTypes, responses] = await Promise.all([
    prisma.surveyType.findMany({
      include: { questions: { orderBy: { orderIndex: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.surveyResponse.findMany({
      where: filter,
      include: {
        team: { select: { name: true, code: true } },
        event: {
          select: {
            venueName: true,
            venueCity: true,
            venueState: true,
            eventDate: true,
          },
        },
      },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const typesBySlug = new Map(surveyTypes.map((t) => [t.slug, t]));
  const presentSlugs = new Set(responses.map((r) => r.surveyTypeSlug));

  // One column per question, across every survey type in the results. When the
  // export covers a single type the headers are just the questions; when it
  // covers several, they are prefixed so two "How did you hear about us?"
  // columns can be told apart.
  const needsTypePrefix = presentSlugs.size > 1;
  const questionColumns: { key: string; slug: string; header: string }[] = [];

  for (const surveyType of surveyTypes) {
    if (!presentSlugs.has(surveyType.slug)) continue;
    for (const question of surveyType.questions) {
      const label = `Q${question.orderIndex}. ${question.questionText}`;
      questionColumns.push({
        key: `q${question.orderIndex}`,
        slug: surveyType.slug,
        header: needsTypePrefix ? `${surveyType.name} — ${label}` : label,
      });
    }
  }

  const bodyRows: unknown[][] = [];
  const extraCells: string[] = [];

  for (const response of responses) {
    let answers: Record<string, unknown> = {};
    try {
      answers = JSON.parse(response.responses) as Record<string, unknown>;
    } catch {
      // A row with unreadable answers still belongs in the export — losing the
      // fact that someone took the survey is worse than losing their answers.
    }

    const questions = typesBySlug.get(response.surveyTypeSlug)?.questions ?? [];
    const known = new Set(questions.map((q) => `q${q.orderIndex}`));

    const answerCells = questionColumns.map((column) => {
      if (column.slug !== response.surveyTypeSlug) return "";

      const question = questions.find((q) => `q${q.orderIndex}` === column.key);
      const options = question ? (JSON.parse(question.options) as string[]) : [];
      // "; " not ", " — option labels contain commas of their own.
      return selectedOptions(answers[column.key], options).join("; ");
    });

    // Answers whose question no longer exists. Editing a survey type replaces
    // its questions outright, so older responses can carry keys the current
    // schema has no column for. Dropping them silently would quietly shrink
    // the totals, so they ride along in one last column.
    const orphaned = Object.entries(answers)
      .filter(([key]) => !known.has(key))
      .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("; ") : String(value)}`)
      .join(" | ");
    extraCells.push(orphaned);

    bodyRows.push([
      utcTimestamp(response.completedAt),
      response.team?.name ?? "",
      response.team?.code ?? "",
      describeEvent(response.event),
      response.event?.venueName ?? "",
      response.event?.venueCity ?? "",
      response.event?.venueState ?? "",
      utcDate(response.event?.eventDate ?? null),
      typesBySlug.get(response.surveyTypeSlug)?.name ?? response.surveyTypeSlug,
      response.ageRange ?? "",
      response.durationSeconds ?? "",
      ...answerCells,
    ]);
  }

  const header: unknown[] = [
    "Completed At (UTC)",
    "Team",
    "Team Code",
    "Event",
    "Venue",
    "City",
    "State",
    "Event Date",
    "Survey Type",
    "Age Range",
    "Duration (seconds)",
    ...questionColumns.map((column) => column.header),
  ];

  // Only carry the catch-all column when it actually holds something.
  if (extraCells.some(Boolean)) {
    header.push("Answers To Removed Questions");
    bodyRows.forEach((row, index) => row.push(extraCells[index]));
  }

  return csvResponse(timestampedFilename("survey-responses", new Date()), [
    header,
    ...bodyRows,
  ]);
});

/**
 * The archive export — the layout the survey results were kept in before this
 * app existed, so a new season's numbers can be pasted straight underneath the
 * old ones instead of living in a spreadsheet of their own.
 *
 * That layout is one row per date + survey type + grouping, and one column per
 * question/answer slot named "1A".."9E": question number, then the answer's
 * position in the question. The cells are counts of how many people picked that
 * answer, not the answers themselves.
 *
 *   Date,Survey_Type,Grouping,1A,1B,1C,1D,1E,2A,...
 *   08_01_2021,Marijuana,D_D,0,2,3,5,0,0,1,9,0,0,...
 */

/** "08_25_2026" — the archive's date format, which is not any ISO one. */
function legacyDate(value: Date): string {
  const iso = value.toISOString();
  return `${iso.slice(5, 7)}_${iso.slice(8, 10)}_${iso.slice(0, 4)}`;
}

/**
 * Survey type names as the archive spells them.
 *
 * The archive uses its own names — "Combo3D_2022" for what this app calls the
 * combination survey — and the whole point of the export is that the values
 * line up with the rows already in the file, so the old spelling wins. Types
 * added since have no archive name; their own name is used, with the spaces
 * turned into underscores to match the house style.
 */
const LEGACY_TYPE_NAMES: Record<string, string> = {
  alcohol: "Alcohol",
  impaired: "Impaired",
  marijuana: "Marijuana",
  combo: "Combo3D_2022",
  distracted: "Distracted",
};

function legacyTypeName(slug: string, name: string): string {
  return LEGACY_TYPE_NAMES[slug] ?? name.trim().replace(/[^A-Za-z0-9]+/g, "_");
}

/**
 * The archive's grouping code, e.g. "B_A".
 *
 * The first letter is the age bracket. The second letter is a dimension the
 * archive tracked that the kiosk does not collect, so it is written as "U" —
 * an unmistakable placeholder, rather than a letter that would look like real
 * data and quietly land in the wrong cell of somebody's pivot table.
 */
const AGE_LETTERS: Record<string, string> = {
  "13-17": "A",
  "18-24": "B",
  "25-34": "C",
  "35+": "D",
};

const UNKNOWN_GROUPING_LETTER = "U";

function legacyGrouping(ageRange: string | null): string {
  const age = AGE_LETTERS[ageRange ?? ""] ?? UNKNOWN_GROUPING_LETTER;
  return `${age}_${UNKNOWN_GROUPING_LETTER}`;
}

// GET /api/surveys/export/legacy.csv - Counts in the pre-app archive layout
surveysRouter.get("/export/legacy.csv", async (c) => {
  const filter = responseFilter(exportQuery(c));

  const [surveyTypes, responses] = await Promise.all([
    prisma.surveyType.findMany({
      include: { questions: { orderBy: { orderIndex: "asc" } } },
    }),
    prisma.surveyResponse.findMany({
      where: filter,
      include: { event: { select: { eventDate: true } } },
    }),
  ]);

  const typesBySlug = new Map(surveyTypes.map((t) => [t.slug, t]));

  // The archive keeps five answer slots per question even for questions with
  // fewer answers, which is what makes "column N holds question K" arithmetic
  // work in the old sheets. A question with more than five answers widens every
  // block rather than just its own, so that stays true.
  let slotsPerQuestion = 5;
  let questionCount = 0;

  for (const response of responses) {
    const questions = typesBySlug.get(response.surveyTypeSlug)?.questions ?? [];
    for (const question of questions) {
      questionCount = Math.max(questionCount, question.orderIndex);
      const options = JSON.parse(question.options) as string[];
      slotsPerQuestion = Math.max(slotsPerQuestion, options.length);
    }
  }

  /** One row per date + type + grouping, with the counts accumulated into it. */
  const buckets = new Map<string, {
    date: string;
    typeName: string;
    grouping: string;
    counts: number[];
  }>();

  for (const response of responses) {
    const surveyType = typesBySlug.get(response.surveyTypeSlug);
    // A response whose type has been deleted has no questions to place its
    // answers under, so there is no row it can honestly become.
    if (!surveyType) continue;

    const date = legacyDate(response.event?.eventDate ?? response.completedAt);
    const typeName = legacyTypeName(surveyType.slug, surveyType.name);
    const grouping = legacyGrouping(response.ageRange);
    const key = `${date}|${typeName}|${grouping}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        date,
        typeName,
        grouping,
        counts: new Array(questionCount * slotsPerQuestion).fill(0),
      };
      buckets.set(key, bucket);
    }

    let answers: Record<string, unknown> = {};
    try {
      answers = JSON.parse(response.responses) as Record<string, unknown>;
    } catch {
      // Unreadable answers still leave the survey counted in its row's date,
      // type and grouping; only the answer columns lose it.
    }

    for (const question of surveyType.questions) {
      const options = JSON.parse(question.options) as string[];
      const picked = selectedOptions(answers[`q${question.orderIndex}`], options);

      for (const choice of picked) {
        const slot = options.indexOf(choice);
        if (slot < 0) continue;
        bucket.counts[(question.orderIndex - 1) * slotsPerQuestion + slot]! += 1;
      }
    }
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const header: unknown[] = ["Date", "Survey_Type", "Grouping"];
  for (let q = 1; q <= questionCount; q++) {
    for (let slot = 0; slot < slotsPerQuestion; slot++) {
      header.push(`${q}${letters[slot]}`);
    }
  }

  // Oldest first, the order the archive grew in, so an export appends cleanly
  // to the bottom of the existing file.
  const rows = [...buckets.values()]
    .sort((a, b) => {
      const dateA = `${a.date.slice(6)}${a.date.slice(0, 2)}${a.date.slice(3, 5)}`;
      const dateB = `${b.date.slice(6)}${b.date.slice(0, 2)}${b.date.slice(3, 5)}`;
      return dateA.localeCompare(dateB)
        || a.typeName.localeCompare(b.typeName)
        || a.grouping.localeCompare(b.grouping);
    })
    .map((bucket) => [bucket.date, bucket.typeName, bucket.grouping, ...bucket.counts]);

  return csvResponse(timestampedFilename("survey-archive-format", new Date()), [
    header,
    ...rows,
  ]);
});

export { surveysRouter };
