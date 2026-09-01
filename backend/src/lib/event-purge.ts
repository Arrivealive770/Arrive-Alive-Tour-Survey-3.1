import { prisma } from "../prisma";
import { purgeEventParticipantData, type EventPurgeResult } from "./pledge-privacy";
import { describeEventReadiness, RUN_LONG_GRACE_MS } from "./event-readiness";

/**
 * Scheduled end-of-event purge.
 *
 * An event is due once somebody has ended it — the facilitator on a device or
 * staff in the admin portal marking it completed. Every photo and every
 * participant email address belonging to it is then deleted automatically;
 * nobody has to remember to press a button. Survey answers are never touched.
 *
 * The event's scheduled end time (`Event.eventEndAt`) does NOT make it due.
 * Events run late, and purging on the printed end time deleted photos while
 * the station was still handing them out. The scheduled end is only a backstop:
 * an event still open {@link RUN_LONG_GRACE_MS} after it was meant to finish
 * was forgotten, and gets purged so participant photos don't linger.
 *
 * The purge does not fire the instant the clock strikes: it waits until the
 * surveys and pledge photos have finished uploading (see event-readiness.ts),
 * so an event is never wiped out from under a tablet that is still catching up.
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
   * Purge every finished event whose uploads have landed. Safe to call directly
   * (the admin portal exposes it as POST /api/events/purge-due).
   */
  async runOnce(): Promise<EventPurgeResult[]> {
    // A slow purge must not overlap with the next tick.
    if (this.isPurging) return [];
    this.isPurging = true;

    try {
      const now = new Date();

      // Either kind of "over": somebody ended it, or it was left open long
      // enough past its scheduled end that it is plainly not still running.
      const forgottenBefore = new Date(now.getTime() - RUN_LONG_GRACE_MS);
      const dueEvents = await prisma.event.findMany({
        where: {
          photosPurgedAt: null,
          OR: [
            { eventEndAt: { not: null, lte: forgottenBefore } },
            { status: "completed" },
          ],
        },
        select: { id: true, venueName: true, eventEndAt: true, status: true },
      });

      if (dueEvents.length === 0) return [];

      const results: EventPurgeResult[] = [];

      for (const event of dueEvents) {
        try {
          const readiness = await describeEventReadiness(event.id, now);

          if (!readiness?.ready) {
            // Normal on the first ticks after an event ends. Logged so staff
            // watching the server can see the purge is waiting, not stuck.
            console.log(
              `[EventPurge] "${event.venueName}" not ready yet — waiting on ` +
                `${readiness?.waitingOn.join(", ") || "unknown"}`
            );
            continue;
          }

          if (readiness.forced) {
            console.warn(
              `[EventPurge] "${event.venueName}" hit the 24h limit with uploads ` +
                `outstanding (${readiness.waitingOn.join(", ")}) — purging anyway`
            );
          }

          const result = await purgeEventParticipantData(event.id);

          // An event that has been purged is finished by definition, so the
          // tablets should stop offering it even if nobody closed it by hand.
          if (event.status !== "completed") {
            await prisma.event.update({
              where: { id: event.id },
              data: { status: "completed", completedAt: readiness.endedAt ?? now },
            });
          }

          results.push(result);
          console.log(
            `[EventPurge] "${event.venueName}" ended ${readiness.endedAt?.toISOString()} — ` +
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
