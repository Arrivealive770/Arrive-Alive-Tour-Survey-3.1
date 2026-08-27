/**
 * Whether an event has been finished — deliberately, by a person.
 *
 * The clock used to get a vote here. An event ended when its `eventEndAt`
 * passed, or when its calendar day rolled over, and the event watcher acted on
 * that by clearing the event and sending the tablet back to the menu.
 *
 * That was wrong for how the tour actually runs. Events overrun, crews stay
 * late, and a tablet that decides on its own that the night is over is worse
 * than useless — it took the app down with it. The teardown fired from a
 * provider wrapping the whole app, so when it landed mid-survey it pulled the
 * kiosk stack out from under a screen that was still animating.
 *
 * Now nothing ends an event except a person: the crew ending it on the tablet,
 * or the home office marking it complete in the admin portal. Scheduled times
 * are still recorded and still shown when picking an area — they just don't
 * decide anything.
 */

export interface EventTiming {
  status?: 'active' | 'completed' | string | null;
  /** Kept for display and sorting. No longer used to decide anything. */
  eventDate?: string | null;
  /** Kept for display. No longer used to decide anything. */
  eventEndAt?: string | null;
  timeZone?: string | null;
}

/**
 * True only when someone marked this event complete. Never true because of the
 * time of day or the date.
 */
export function isEventOver(event: EventTiming | null | undefined): boolean {
  if (!event) return false;
  return event.status === 'completed';
}
