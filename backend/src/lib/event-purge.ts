import { prisma } from "../prisma";
import { purgeEventParticipantData, type EventPurgeResult } from "./pledge-privacy";

/**
 * Scheduled end-of-event purge.
 *
 * Every event can be given a designated end time (`Event.eventEndAt`). Once
 * that time passes, every photo and every participant email address belonging
 * to that event is deleted automatically — nobody has to remember to press a
 * button. Survey answers are never touched.
 *
 * `Event.photosPurgedAt` is stamped when an event has been handled, so an event
 * is only ever purged once.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class EventPurgeScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isPurging = false;

  start(): void {
    if (this.intervalId) {
      console.log("[EventPurge] Scheduler already running");
      return;
    }

    console.log(
      `[EventPurge] Scheduler started (checking every ${CHECK_INTERVAL_MS / 60000} minutes)`
    );

    // Run once at boot: a server that was down over an event's end time must
    // still purge as soon as it comes back.
    void this.runOnce();

    this.intervalId = setInterval(() => {
      void this.runOnce();
    }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[EventPurge] Scheduler stopped");
    }
  }

  /**
   * Purge every event whose designated end time has passed. Safe to call
   * directly (the admin portal exposes it as POST /api/events/purge-due).
   */
  async runOnce(): Promise<EventPurgeResult[]> {
    // A slow purge must not overlap with the next tick.
    if (this.isPurging) return [];
    this.isPurging = true;

    try {
      const dueEvents = await prisma.event.findMany({
        where: {
          eventEndAt: { not: null, lte: new Date() },
          photosPurgedAt: null,
        },
        select: { id: true, venueName: true, eventEndAt: true },
      });

      if (dueEvents.length === 0) return [];

      const results: EventPurgeResult[] = [];

      for (const event of dueEvents) {
        try {
          const result = await purgeEventParticipantData(event.id);
          results.push(result);
          console.log(
            `[EventPurge] "${event.venueName}" ended ${event.eventEndAt?.toISOString()} — ` +
              `deleted ${result.purgedPhotoCount} photo(s), ` +
              `${result.purgedPledgeCount} email address(es), ` +
              `${result.purgedQueuedEmailCount} unsent email(s); ` +
              `kept ${result.survivingSurveyResponseCount} survey response(s)`
          );
        } catch (error) {
          // One bad event must not stop the others from being purged. The
          // event keeps photosPurgedAt = null, so the next tick retries it.
          console.error(`[EventPurge] Failed to purge event ${event.id}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error("[EventPurge] Scheduler run failed:", error);
      return [];
    } finally {
      this.isPurging = false;
    }
  }
}

export const eventPurgeScheduler = new EventPurgeScheduler();
