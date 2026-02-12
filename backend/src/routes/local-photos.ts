import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const localPhotosRouter = new Hono();

// Schema for receiving photo metadata from phones
const receivePhotoSchema = z.object({
  localId: z.string().min(1, "Local ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  eventId: z.string().min(1, "Event ID is required"),
  overlayType: z.string().min(1, "Overlay type is required"),
  photoBase64: z.string().min(1, "Photo data is required"), // We receive it but don't store it on server
  deviceId: z.string().min(1, "Device ID is required"),
});

// Schema for syncing photos to tablet
const syncToTabletSchema = z.object({
  localIds: z.array(z.string()).min(1, "At least one local ID is required"),
  tabletDeviceId: z.string().min(1, "Tablet device ID is required"),
});

/**
 * GET /api/local-photos/health
 * Simple health check endpoint for connection testing
 */
localPhotosRouter.get("/health", (c) => {
  return c.json({
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/local-photos/receive
 * Receives photo metadata from phones
 * Stores metadata in database (but NOT the actual file - that stays local on tablet)
 */
localPhotosRouter.post(
  "/receive",
  zValidator("json", receivePhotoSchema),
  async (c) => {
    try {
      const { localId, teamId, eventId, overlayType, deviceId } =
        c.req.valid("json");

      console.log("[LocalPhoto] Received photo metadata:", {
        localId,
        teamId,
        eventId,
        overlayType,
        deviceId,
      });

      // Check for duplicate localId (idempotency)
      const existingPhoto = await prisma.localPhoto.findUnique({
        where: { localId },
      });

      if (existingPhoto) {
        console.log("[LocalPhoto] Found existing photo with localId:", localId);
        return c.json({
          data: {
            success: true,
            localId: existingPhoto.localId,
          },
        });
      }

      // Verify team exists
      const team = await prisma.team.findUnique({
        where: { id: teamId },
      });

      if (!team) {
        console.log("[LocalPhoto] Team not found:", teamId);
        return c.json(
          { error: { message: "Team not found", code: "TEAM_NOT_FOUND" } },
          404
        );
      }

      // Verify event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        console.log("[LocalPhoto] Event not found:", eventId);
        return c.json(
          { error: { message: "Event not found", code: "EVENT_NOT_FOUND" } },
          404
        );
      }

      // Create local photo metadata record
      const localPhoto = await prisma.localPhoto.create({
        data: {
          localId,
          teamId,
          eventId,
          overlayType,
          deviceId,
          syncedToTablet: false,
        },
      });

      console.log("[LocalPhoto] Photo metadata created:", localPhoto.id);

      return c.json(
        {
          data: {
            success: true,
            localId: localPhoto.localId,
          },
        },
        201
      );
    } catch (error) {
      console.error("[LocalPhoto] Error receiving photo:", error);
      return c.json(
        { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
        500
      );
    }
  }
);

/**
 * GET /api/local-photos/:teamId/:eventId
 * Get list of local photo metadata for a team/event
 * Used by tablets to see what photos are available
 */
localPhotosRouter.get("/:teamId/:eventId", async (c) => {
  try {
    const teamId = c.req.param("teamId");
    const eventId = c.req.param("eventId");
    const syncedOnly = c.req.query("syncedOnly") === "true";
    const unsyncedOnly = c.req.query("unsyncedOnly") === "true";

    console.log("[LocalPhoto] Fetching photos for team/event:", {
      teamId,
      eventId,
      syncedOnly,
      unsyncedOnly,
    });

    // Build where clause based on query params
    const whereClause: {
      teamId: string;
      eventId: string;
      syncedToTablet?: boolean;
    } = {
      teamId,
      eventId,
    };

    if (syncedOnly) {
      whereClause.syncedToTablet = true;
    } else if (unsyncedOnly) {
      whereClause.syncedToTablet = false;
    }

    const photos = await prisma.localPhoto.findMany({
      where: whereClause,
      include: {
        team: {
          select: { id: true, name: true, code: true },
        },
        event: {
          select: {
            id: true,
            venueName: true,
            venueCity: true,
            venueState: true,
            eventDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({
      data: {
        photos,
      },
    });
  } catch (error) {
    console.error("[LocalPhoto] Error fetching photos:", error);
    return c.json(
      { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
      500
    );
  }
});

/**
 * POST /api/local-photos/sync-to-tablet
 * Called when photos need to be synced to a specific tablet
 * Marks photos as synced to tablet
 */
localPhotosRouter.post(
  "/sync-to-tablet",
  zValidator("json", syncToTabletSchema),
  async (c) => {
    try {
      const { localIds, tabletDeviceId } = c.req.valid("json");

      console.log("[LocalPhoto] Syncing photos to tablet:", {
        localIds,
        tabletDeviceId,
      });

      // Update photos as synced to tablet
      const result = await prisma.localPhoto.updateMany({
        where: {
          localId: { in: localIds },
        },
        data: {
          syncedToTablet: true,
          tabletDeviceId,
          syncedAt: new Date(),
        },
      });

      console.log("[LocalPhoto] Photos synced:", result.count);

      return c.json({
        data: {
          success: true,
          syncedCount: result.count,
          localIds,
        },
      });
    } catch (error) {
      console.error("[LocalPhoto] Error syncing to tablet:", error);
      return c.json(
        { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
        500
      );
    }
  }
);

export { localPhotosRouter };
