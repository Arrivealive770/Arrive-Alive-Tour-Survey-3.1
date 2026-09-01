/**
 * One definition of "this event is over", used by every screen that has to
 * decide whether to keep collecting for it.
 *
 * The scheduled end time is a plan, not a shutdown. Events run long — the line
 * is still out the door at closing time — and a tablet that sent itself back
 * to the menu at 9pm sharp took the station down while the event was still
 * going. So an event ends when a person ends it:
 *
 *  - the facilitator taps "End Event" on this device, or
 *  - the home office marks it completed in the admin portal
 *
 * The only ending left to the clock is a backstop hours past the scheduled end
 * ({@link RUN_LONG_GRACE_MS}): a tablet packed away without anyone closing the
 * event must not still be attributing surveys to it the next morning.
 *
 * Nothing here gates the *start*. Crews arrive early to set up, so an event can
 * be selected and worked before its start time — the start time is only shown,
 * never enforced.
 */

/** How long past its scheduled end an event nobody closed is finally closed. */
export const RUN_LONG_GRACE_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface EventTiming {
  status?: 'active' | 'completed' | string | null;
  eventDate?: string | null;
  eventEndAt?: string | null;
}

/** Parse an ISO timestamp, or null if it is missing or unusable. */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The last moment of the local day the given instant falls in. */
function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** When the event is scheduled to start. */
export function eventStartsAt(event: EventTiming | null | undefined): Date | null {
  return parseDate(event?.eventDate);
}

/** When the event is scheduled to end, if the office set an end time. */
export function eventScheduledEndAt(event: EventTiming | null | undefined): Date | null {
  return parseDate(event?.eventEndAt);
}

/**
 * The backstop: when a still-open event is closed automatically because nobody
 * closed it. Well after the scheduled end, so running late never trips it.
 */
export function eventAutoCloseAt(event: EventTiming | null | undefined): Date | null {
  const scheduledEnd = eventScheduledEndAt(event);
  if (scheduledEnd) return new Date(scheduledEnd.getTime() + RUN_LONG_GRACE_MS);

  // No end time was set, so the event's own day is all there is to go on.
  const day = eventStartsAt(event);
  if (day) return new Date(endOfDay(day).getTime() + RUN_LONG_GRACE_MS);

  return null;
}

export function isEventOver(event: EventTiming | null | undefined, now: Date = new Date()): boolean {
  if (!event) return false;

  // Somebody ended it — the facilitator here, or the home office.
  if (event.status === 'completed') return true;

  const autoCloseAt = eventAutoCloseAt(event);
  return autoCloseAt !== null && now.getTime() >= autoCloseAt.getTime();
}

/**
 * The event is past its printed end time but still running, because nobody has
 * ended it. Normal, and worth saying on screen so the crew knows the tablet is
 * waiting on them rather than about to shut itself off.
 */
export function isEventRunningLate(
  event: EventTiming | null | undefined,
  now: Date = new Date()
): boolean {
  if (!event || isEventOver(event, now)) return false;
  const scheduledEnd = eventScheduledEndAt(event);
  return scheduledEnd !== null && now.getTime() >= scheduledEnd.getTime();
}

/** The event's start time hasn't arrived yet. Setting up early is expected. */
export function isEventNotStartedYet(
  event: EventTiming | null | undefined,
  now: Date = new Date()
): boolean {
  const startsAt = eventStartsAt(event);
  return startsAt !== null && now.getTime() < startsAt.getTime();
}

/** Short reason to show the crew on the menu after an event ends on its own. */
export function eventOverReason(event: EventTiming | null | undefined): string {
  if (event?.status === 'completed') return 'This event was ended by the home office.';
  return 'This event was left open well past its end time, so it was closed automatically.';
}
