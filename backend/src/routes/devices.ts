import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const devicesRouter = new Hono();

// GET /api/devices - List devices (filter by teamId query param)
devicesRouter.get("/", async (c) => {
  const teamId = c.req.query("teamId");

  const devices = await prisma.device.findMany({
    where: teamId ? { teamId } : undefined,
    include: {
      team: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: devices });
});

// GET /api/devices/:id - Get device by ID
devicesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      team: true,
    },
  });

  if (!device) {
    return c.json({ error: { message: "Device not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: device });
});

// POST /api/devices - Register new device
const createDeviceSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  deviceType: z.enum(["tablet", "phone"]),
  deviceName: z.string().min(1, "Device name is required"),
});

devicesRouter.post(
  "/",
  zValidator("json", createDeviceSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
    });

    if (!team) {
      return c.json({ error: { message: "Team not found", code: "TEAM_NOT_FOUND" } }, 404);
    }

    const device = await prisma.device.create({
      data: {
        teamId: data.teamId,
        deviceType: data.deviceType,
        deviceName: data.deviceName,
        isActive: true,
      },
      include: {
        team: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return c.json({ data: device }, 201);
  }
);

// PUT /api/devices/:id - Update device
const updateDeviceSchema = z.object({
  deviceName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

devicesRouter.put(
  "/:id",
  zValidator("json", updateDeviceSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existingDevice = await prisma.device.findUnique({
      where: { id },
    });

    if (!existingDevice) {
      return c.json({ error: { message: "Device not found", code: "NOT_FOUND" } }, 404);
    }

    const device = await prisma.device.update({
      where: { id },
      data: {
        ...(data.deviceName !== undefined && { deviceName: data.deviceName }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        team: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return c.json({ data: device });
  }
);

// PUT /api/devices/:id/heartbeat - Update lastSyncAt timestamp
devicesRouter.put("/:id/heartbeat", async (c) => {
  const id = c.req.param("id");

  const existingDevice = await prisma.device.findUnique({
    where: { id },
  });

  if (!existingDevice) {
    return c.json({ error: { message: "Device not found", code: "NOT_FOUND" } }, 404);
  }

  const device = await prisma.device.update({
    where: { id },
    data: {
      lastSyncAt: new Date(),
    },
  });

  return c.json({ data: device });
});

export { devicesRouter };
