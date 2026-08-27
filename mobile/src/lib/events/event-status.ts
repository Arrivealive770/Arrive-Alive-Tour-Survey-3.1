/**
 * One definition of "this event is over", used by every screen that has to
 * decide whether to keep collecting for it.
 *
 * An event ends when any of these is true:
 *  - the home office marked it completed in the admin portal
 *  - its scheduled end time (eventEndAt) has passed
 *  - the calendar day it was scheduled for has passed — this is the offline
 *    safety net, because a tablet left running overnight has no other way to
 *    know yesterday's event is done.
 *
 * All of it is judged in the venue's time zone (see event-time.ts), so the
 * tablet's own clock setting can't end an event early or late.
 */

import { dayKeyInZone } from './event-time';

export interface EventTiming {
  status?: 'active' | 'completed' | string | null;
  eventDate?: string | null;
  eventEndAt?: string | null;
  /** Venue's IANA zone; the day rollover is judged in it, not the tablet's. */
  timeZone?: string | null;
}

export function isEventOver(event: EventTiming | null | undefined, now: Date = new Date()): boolean {
  if (!event) return false;

  if (event.status === 'completed') return true;

  if (event.eventEndAt) {
    const endAt = new Date(event.eventEndAt);
    if (!Number.isNaN(endAt.getTime()) && now.getTime() >= endAt.getTime()) {
      return true;
    }
  }

  if (event.eventDate) {
    // Days are counted the way the venue counts them. A tablet on UTC would
    // otherwise roll over to "tomorrow" at 7pm Central and close the event
    // hours early.
    const eventDay = dayKeyInZone(event.eventDate, event.timeZone);
    const today = dayKeyInZone(now, event.timeZone);

    // Strictly before today — an event still on its own day is never expired
    // by date alone, however late it runs.
    if (eventDay && today && eventDay < today) {
      return true;
    }
  }

  return false;
}

/** Short reason to show the crew on the menu after an event auto-ends. */
export function eventOverReason(event: EventTiming | null | undefined): string {
  if (event?.status === 'completed') return 'This event was marked complete by the home office.';
  if (event?.eventEndAt) return 'This event has reached its scheduled end time.';
  return 'This event day has ended.';
}
