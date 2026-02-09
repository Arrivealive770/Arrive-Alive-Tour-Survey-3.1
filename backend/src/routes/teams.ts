import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const teamsRouter = new Hono();

// GET /api/teams - List all teams
teamsRouter.get("/", async (c) => {
  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: teams });
});

// GET /api/teams/:id - Get team by ID
teamsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      devices: true,
      events: {
        orderBy: { eventDate: "desc" },
        take: 10,
      },
    },
  });

  if (!team) {
    return c.json({ error: { message: "Team not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: team });
});

// GET /api/teams/code/:code - Get team by short code (for device pairing)
teamsRouter.get("/code/:code", async (c) => {
  const code = c.req.param("code");
  const team = await prisma.team.findUnique({
    where: { code },
  });

  if (!team) {
    return c.json({ error: { message: "Team not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: team });
});

// POST /api/teams - Create team
const createTeamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(2, "Code must be at least 2 characters").max(10, "Code must be at most 10 characters"),
});

teamsRouter.post(
  "/",
  zValidator("json", createTeamSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Check if code already exists
    const existingTeam = await prisma.team.findUnique({
      where: { code: data.code },
    });

    if (existingTeam) {
      return c.json({ error: { message: "Team code already exists", code: "CODE_EXISTS" } }, 400);
    }

    const team = await prisma.team.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
      },
    });

    return c.json({ data: team }, 201);
  }
);

// PUT /api/teams/:id - Update team
const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(2).max(10).optional(),
});

teamsRouter.put(
  "/:id",
  zValidator("json", updateTeamSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existingTeam = await prisma.team.findUnique({
      where: { id },
    });

    if (!existingTeam) {
      return c.json({ error: { message: "Team not found", code: "NOT_FOUND" } }, 404);
    }

    // If updating code, check for conflicts
    if (data.code && data.code !== existingTeam.code) {
      const codeConflict = await prisma.team.findUnique({
        where: { code: data.code.toUpperCase() },
      });
      if (codeConflict) {
        return c.json({ error: { message: "Team code already exists", code: "CODE_EXISTS" } }, 400);
      }
    }

    const team = await prisma.team.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
      },
    });

    return c.json({ data: team });
  }
);

export { teamsRouter };
