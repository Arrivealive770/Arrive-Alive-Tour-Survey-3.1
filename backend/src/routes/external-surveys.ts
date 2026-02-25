import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const externalSurveysRouter = new Hono();

// POST /api/external-surveys/import
// Body: { eventId, surveyPhase, fileName, csvText }
const importSchema = z.object({
  eventId: z.string().min(1),
  surveyPhase: z.enum(["pre", "post"]),
  fileName: z.string().min(1),
  csvText: z.string().min(1),
});

externalSurveysRouter.post(
  "/import",
  zValidator("json", importSchema),
  async (c) => {
    const { eventId, surveyPhase, fileName, csvText } = c.req.valid("json");

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return c.json({ error: { message: "Event not found", code: "NOT_FOUND" } }, 404);
    }

    // Parse CSV
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return c.json({ error: { message: "CSV must have a header row and at least one data row", code: "INVALID_CSV" } }, 400);
    }

    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]!);
    const dataRows = lines.slice(1);

    // Create import record
    const importRecord = await prisma.externalSurveyImport.create({
      data: {
        eventId,
        surveyPhase,
        fileName,
        rowCount: dataRows.length,
        headers: JSON.stringify(headers),
        rows: {
          create: dataRows.map((line, idx) => {
            const values = parseRow(line);
            const rowData: Record<string, string> = {};
            headers.forEach((h, i) => {
              rowData[h] = values[i] ?? "";
            });
            return {
              rowIndex: idx,
              data: JSON.stringify(rowData),
            };
          }),
        },
      },
      include: {
        rows: false,
        event: { select: { id: true, venueName: true } },
      },
    });

    return c.json({ data: importRecord }, 201);
  }
);

// GET /api/external-surveys?eventId=xxx
externalSurveysRouter.get("/", async (c) => {
  const eventId = c.req.query("eventId");

  const imports = await prisma.externalSurveyImport.findMany({
    where: eventId ? { eventId } : undefined,
    include: {
      event: { select: { id: true, venueName: true, eventDate: true } },
    },
    orderBy: { importedAt: "desc" },
  });

  return c.json({ data: imports });
});

// GET /api/external-surveys/:id - Get import with rows
externalSurveysRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const importRecord = await prisma.externalSurveyImport.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, venueName: true, eventDate: true } },
      rows: { orderBy: { rowIndex: "asc" } },
    },
  });

  if (!importRecord) {
    return c.json({ error: { message: "Import not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: importRecord });
});

// DELETE /api/external-surveys/:id
externalSurveysRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const importRecord = await prisma.externalSurveyImport.findUnique({ where: { id } });
  if (!importRecord) {
    return c.json({ error: { message: "Import not found", code: "NOT_FOUND" } }, 404);
  }

  await prisma.externalSurveyImport.delete({ where: { id } });

  return c.json({ data: { success: true } });
});

export { externalSurveysRouter };
