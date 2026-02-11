import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { queuePledgeEmail } from "../lib/email-queue-processor";

const syncRouter = new Hono();

// POST /api/sync/surveys - Batch upload survey responses (array of surveys, deviceId)
const batchSurveySchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  teamId: z.string().optional(), // Optional, included by mobile app
  surveys: z.array(
    z.object({
      localId: z.string(),
      teamId: z.string(),
      eventId: z.string(),
      surveyTypeSlug: z.string(),
      responses: z.record(z.string(), z.any()),
      ageRange: z.string().optional().nullable(),
      deviceId: z.string().optional(), // Mobile may include this
      completedAt: z.string().optional(),
      durationSeconds: z.number().int().optional().nullable(), // Allow 0 or null
    })
  ),
});

syncRouter.post(
  "/surveys",
  async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      return c.json({ error: { message: "Invalid JSON body" } }, 400);
    }

    const parseResult = batchSurveySchema.safeParse(body);
    if (!parseResult.success) {
      console.error("[Sync] Survey validation error:", JSON.stringify(parseResult.error.issues, null, 2));
      return c.json({ error: { message: "Validation failed", details: parseResult.error.issues } }, 400);
    }

    const { deviceId, surveys } = parseResult.data;

    // Verify device exists
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return c.json({ error: { message: "Device not found", code: "DEVICE_NOT_FOUND" } }, 404);
    }

    const results = {
      synced: [] as string[],
      skipped: [] as string[],
      errors: [] as { localId: string; error: string }[],
    };

    for (const survey of surveys) {
      try {
        // Check for existing
        const existing = await prisma.surveyResponse.findUnique({
          where: { localId: survey.localId },
        });

        if (existing) {
          results.skipped.push(survey.localId);
          continue;
        }

        await prisma.surveyResponse.create({
          data: {
            localId: survey.localId,
            teamId: survey.teamId,
            eventId: survey.eventId,
            surveyTypeSlug: survey.surveyTypeSlug,
            responses: JSON.stringify(survey.responses),
            ageRange: survey.ageRange,
            deviceId: deviceId,
            completedAt: survey.completedAt ? new Date(survey.completedAt) : new Date(),
            durationSeconds: survey.durationSeconds,
            syncedAt: new Date(),
          },
        });

        results.synced.push(survey.localId);
      } catch (error) {
        results.errors.push({
          localId: survey.localId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Update device lastSyncAt
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });

    // Log sync
    await prisma.syncLog.create({
      data: {
        deviceId,
        teamId: device.teamId,
        syncType: "surveys",
        itemCount: results.synced.length,
        status: results.errors.length === 0 ? "success" : results.synced.length > 0 ? "partial" : "failed",
        errorDetail: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
      },
    });

    return c.json({ data: results });
  }
);

// POST /api/sync/pledges - Batch upload pledges (array of pledges, deviceId)
const batchPledgesSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  teamId: z.string().optional(), // Optional, included by mobile app
  pledges: z.array(
    z.object({
      localId: z.string(),
      teamId: z.string(),
      eventId: z.string(),
      email: z.string().email().optional().nullable(),
      surveyLocalId: z.string().optional().nullable(), // Mobile sends surveyLocalId, not surveyResponseId
      surveyResponseId: z.string().optional().nullable(),
      photoLocalId: z.string().optional().nullable(), // Mobile sends photoLocalId, not photoId
      photoId: z.string().optional().nullable(),
      compositedPhotoUrl: z.string().optional().nullable(), // New field for composited photo
      createdAt: z.string().optional(),
    })
  ),
});

syncRouter.post(
  "/pledges",
  zValidator("json", batchPledgesSchema),
  async (c) => {
    const { deviceId, pledges } = c.req.valid("json");

    // Verify device exists
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return c.json({ error: { message: "Device not found", code: "DEVICE_NOT_FOUND" } }, 404);
    }

    const results = {
      synced: [] as string[],
      skipped: [] as string[],
      errors: [] as { localId: string; error: string }[],
    };

    for (const pledge of pledges) {
      try {
        // Check for existing
        const existing = await prisma.pledge.findUnique({
          where: { localId: pledge.localId },
        });

        if (existing) {
          results.skipped.push(pledge.localId);
          continue;
        }

        const createdPledge = await prisma.pledge.create({
          data: {
            localId: pledge.localId,
            teamId: pledge.teamId,
            eventId: pledge.eventId,
            email: pledge.email || "",
            surveyResponseId: pledge.surveyResponseId || undefined,
            photoId: pledge.photoId || undefined,
            emailStatus: pledge.email ? "pending" : "skipped",
            createdAt: pledge.createdAt ? new Date(pledge.createdAt) : new Date(),
            syncedAt: new Date(),
          },
        });

        // Queue email for sending if pledge has an email address
        if (pledge.email) {
          // Get photo URL - prefer composited photo, fallback to regular photo
          let photoUrl: string | undefined = pledge.compositedPhotoUrl || undefined;

          if (!photoUrl && pledge.photoId) {
            const photo = await prisma.photo.findUnique({
              where: { id: pledge.photoId },
              select: { storageUrl: true },
            });
            photoUrl = photo?.storageUrl || undefined;
          }

          // Queue the pledge email
          await queuePledgeEmail(createdPledge.id, pledge.email, photoUrl);
        }

        results.synced.push(pledge.localId);
      } catch (error) {
        results.errors.push({
          localId: pledge.localId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Update device lastSyncAt
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });

    // Log sync
    await prisma.syncLog.create({
      data: {
        deviceId,
        teamId: device.teamId,
        syncType: "pledges",
        itemCount: results.synced.length,
        status: results.errors.length === 0 ? "success" : results.synced.length > 0 ? "partial" : "failed",
        errorDetail: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
      },
    });

    return c.json({ data: results });
  }
);

// POST /api/sync/photos - Batch upload photo metadata
const batchPhotosSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  photos: z.array(
    z.object({
      localId: z.string(),
      teamId: z.string(),
      eventId: z.string(),
      overlayType: z.string(),
      storageKey: z.string().optional(),
      storageUrl: z.string().optional(),
      createdAt: z.string().optional(),
    })
  ),
});

syncRouter.post(
  "/photos",
  zValidator("json", batchPhotosSchema),
  async (c) => {
    const { deviceId, photos } = c.req.valid("json");

    // Verify device exists
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return c.json({ error: { message: "Device not found", code: "DEVICE_NOT_FOUND" } }, 404);
    }

    const results = {
      synced: [] as string[],
      skipped: [] as string[],
      errors: [] as { localId: string; error: string }[],
    };

    for (const photo of photos) {
      try {
        // Check for existing
        const existing = await prisma.photo.findUnique({
          where: { localId: photo.localId },
        });

        if (existing) {
          results.skipped.push(photo.localId);
          continue;
        }

        await prisma.photo.create({
          data: {
            localId: photo.localId,
            teamId: photo.teamId,
            eventId: photo.eventId,
            overlayType: photo.overlayType,
            storageKey: photo.storageKey,
            storageUrl: photo.storageUrl,
            status: photo.storageUrl ? "uploaded" : "pending",
            createdAt: photo.createdAt ? new Date(photo.createdAt) : new Date(),
            syncedAt: new Date(),
          },
        });

        results.synced.push(photo.localId);
      } catch (error) {
        results.errors.push({
          localId: photo.localId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Update device lastSyncAt
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });

    // Log sync
    await prisma.syncLog.create({
      data: {
        deviceId,
        teamId: device.teamId,
        syncType: "photos",
        itemCount: results.synced.length,
        status: results.errors.length === 0 ? "success" : results.synced.length > 0 ? "partial" : "failed",
        errorDetail: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
      },
    });

    return c.json({ data: results });
  }
);

// GET /api/sync/photos/:teamId/:eventId - Get photo list for tablet to download
syncRouter.get("/photos/:teamId/:eventId", async (c) => {
  const teamId = c.req.param("teamId");
  const eventId = c.req.param("eventId");

  const photos = await prisma.photo.findMany({
    where: {
      teamId,
      eventId,
      status: { in: ["uploaded", "pending"] },
    },
    select: {
      id: true,
      localId: true,
      storageKey: true,
      storageUrl: true,
      overlayType: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: photos });
});

// POST /api/sync/status - Device reports sync status, gets pending work
const syncStatusSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  lastSyncedSurveyAt: z.string().optional(),
  lastSyncedPledgeAt: z.string().optional(),
  lastSyncedPhotoAt: z.string().optional(),
});

syncRouter.post(
  "/status",
  zValidator("json", syncStatusSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Verify device exists and get team
    const device = await prisma.device.findUnique({
      where: { id: data.deviceId },
      include: { team: true },
    });

    if (!device) {
      return c.json({ error: { message: "Device not found", code: "DEVICE_NOT_FOUND" } }, 404);
    }

    // Get active event for team
    const activeEvent = await prisma.event.findFirst({
      where: {
        teamId: device.teamId,
        status: "active",
      },
    });

    // Count pending photos (for tablets to download from phones)
    const pendingPhotosCount = activeEvent
      ? await prisma.photo.count({
          where: {
            teamId: device.teamId,
            eventId: activeEvent.id,
            status: "uploaded",
            usedAt: null,
          },
        })
      : 0;

    // Get recent sync logs
    const recentLogs = await prisma.syncLog.findMany({
      where: { deviceId: data.deviceId },
      orderBy: { syncedAt: "desc" },
      take: 5,
    });

    // Update heartbeat
    await prisma.device.update({
      where: { id: data.deviceId },
      data: { lastSyncAt: new Date() },
    });

    return c.json({
      data: {
        device: {
          id: device.id,
          deviceType: device.deviceType,
          deviceName: device.deviceName,
          isActive: device.isActive,
        },
        team: {
          id: device.team.id,
          name: device.team.name,
          code: device.team.code,
        },
        activeEvent: activeEvent
          ? {
              id: activeEvent.id,
              venueName: activeEvent.venueName,
              venueCity: activeEvent.venueCity,
              venueState: activeEvent.venueState,
              eventDate: activeEvent.eventDate,
              surveyTypes: JSON.parse(activeEvent.surveyTypes),
              overlayType: activeEvent.overlayType,
              picturePledgeEnabled: activeEvent.picturePledgeEnabled,
            }
          : null,
        pendingWork: {
          photosToDownload: pendingPhotosCount,
        },
        recentLogs,
      },
    });
  }
);

export { syncRouter };
