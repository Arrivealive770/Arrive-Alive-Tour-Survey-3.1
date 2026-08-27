import { prisma } from "../prisma";

/**
 * Gives a time zone to events saved before the portal started asking for one.
 *
 * Event times are stored as instants. Showing one correctly means knowing the
 * zone the venue is in, and `Event.timeZone` is where that lives. Events
 * created before that column existed have null, and both ends then fall back to
 * whatever clock they happen to be running on:
 *
 *   admin portal   the office desktop's zone
 *   tablet         the tablet's own zone
 *
 * A tablet that came out of the box on UTC therefore renders a 9:00 PM end time
 * as 2:00 AM, which is exactly the complaint from the field — the office and
 * the venue reading different numbers off the same event.
 *
 * Filling the column in makes both ends read the same value instead of guessing
 * separately, so they agree by construction rather than by coincidence.
 *
 * Only null rows are touched, so this is safe to run on every boot and safe to
 * run twice. It never rewrites `eventDate` or `eventEndAt` — those instants are
 * already correct, and this is a labelling fix, not a time change. Anything
 * mislabelled can be corrected per-event in the portal, which writes the real
 * zone and wins over this default from then on.
 */

/**
 * The tour's home zone. Matches the fallback already used by the tablet
 * (`deviceTimeZone`) and the admin portal, so nothing shifts for a device that
 * was configured correctly to begin with.
 */
const DEFAULT_TIME_ZONE = "America/Chicago";

export async function backfillEventTimeZones(): Promise<number> {
  const missing = await prisma.event.findMany({
    where: { timeZone: null },
    select: { id: true, venueName: true },
  });

  if (missing.length === 0) return 0;

  const result = await prisma.event.updateMany({
    where: { timeZone: null },
    data: { timeZone: DEFAULT_TIME_ZONE },
  });

  console.log(
    `[TimeZoneBackfill] Set ${result.count} event(s) to ${DEFAULT_TIME_ZONE}: ` +
      missing.map((e) => e.venueName).join(", ")
  );

  return result.count;
}
