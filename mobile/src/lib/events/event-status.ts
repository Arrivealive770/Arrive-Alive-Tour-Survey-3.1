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
 */

export interface EventTiming {
  status?: 'active' | 'completed' | string | null;
  eventDate?: string | null;
  eventEndAt?: string | null;
}

/** Local midnight at the start of the day the given instant falls in. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
    const eventDay = new Date(event.eventDate);
    if (!Number.isNaN(eventDay.getTime())) {
      // Strictly before today — an event still on its own day is never expired
      // by date alone, however late it runs.
      if (startOfDay(eventDay).getTime() < startOfDay(now).getTime()) {
        return true;
      }
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
