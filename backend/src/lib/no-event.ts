import { prisma } from "../prisma";

/**
 * Surveys taken with no event picked.
 *
 * A tablet that can't download the latest event list still has to be able to
 * collect, so the crew can start the kiosk with "no event". Those surveys
 * arrive tagged with this id instead of a real one. A survey must belong to an
 * event, so each team gets one standing "No Event" event that holds them,
 * where the office can find them in the portal.
 *
 * The holding event is created already completed and already purged: tablets
 * only list active events, so it never shows up as somewhere to work, and the
 * end-of-event purge has nothing to do for it (survey answers are never
 * purged anyway).
 */
export const NO_EVENT_ID = "no-event";

/** Every holding event's id starts with this; real event ids are cuids. */
export const HOLDING_EVENT_PREFIX = "no-event-";

export function holdingEventIdFor(teamId: string): string {
  return `${HOLDING_EVENT_PREFIX}${teamId}`;
}

export function isHoldingEventId(eventId: string): boolean {
  return eventId.startsWith(HOLDING_EVENT_PREFIX);
}

/** The team's holding event, created the first time it's needed. */
export async function ensureHoldingEvent(teamId: string): Promise<string> {
  const id = holdingEventIdFor(teamId);
  const now = new Date();

  await prisma.event.upsert({
    where: { id },
    update: {},
    create: {
      id,
      teamId,
      venueName: "No Event (collected offline)",
      venueCity: "Unassigned",
      venueState: "-",
      eventDate: now,
      surveyTypes: "[]",
      overlayType: "default",
      status: "completed",
      completedAt: now,
      photosPurgedAt: now,
    },
  });

  return id;
}
