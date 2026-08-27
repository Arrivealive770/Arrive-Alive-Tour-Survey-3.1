/**
 * Event times are shown in the venue's time zone, never the tablet's.
 *
 * Times are stored as instants (UTC). A tablet whose clock is set to UTC — or
 * that travelled to another state with the tour — used to render a 9:00 PM end
 * time typed in the admin portal as "2:00 AM". The office and the venue must
 * see the same number, so every event time is formatted against the zone the
 * event is actually run in (`Event.timeZone`, e.g. "America/Chicago").
 *
 * Events saved before that column existed have no zone; those fall back to the
 * device's own zone, which is what the app did all along.
 *
 * IMPORTANT — everything here has to survive Hermes, the engine the tablets
 * run. Its Intl support is partial: `Intl.DateTimeFormat.prototype.formatToParts`
 * is missing, and an unknown zone name throws. Nothing in this file may call
 * anything beyond `toLocaleDateString` / `toLocaleTimeString`, and every
 * function must return a value rather than throw — a formatting helper is not
 * worth closing the app over in the middle of an event.
 */

/** The tablet's own zone — the fallback when an event has no zone recorded. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  } catch {
    return 'America/Chicago';
  }
}

function zoneOrDevice(timeZone?: string | null): string | undefined {
  if (timeZone && timeZone.trim()) return timeZone;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    // No Intl at all: let the engine use its own zone by passing nothing.
    return undefined;
  }
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Run a locale format in the venue's zone, then without it if the engine
 * rejects the zone, then give up quietly. Never throws.
 */
function safeFormat(
  date: Date,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  kind: 'date' | 'time'
): string | null {
  const format = (opts: Intl.DateTimeFormatOptions): string =>
    kind === 'time'
      ? date.toLocaleTimeString('en-US', opts)
      : date.toLocaleDateString('en-US', opts);

  const zone = zoneOrDevice(timeZone);

  if (zone) {
    try {
      return format({ ...options, timeZone: zone });
    } catch {
      // Unknown zone name, or an engine built without zone support.
    }
  }

  try {
    return format(options);
  } catch {
    return null;
  }
}

/** "9:00 PM" in the venue's zone. */
export function formatEventTime(
  value: string | Date | null | undefined,
  timeZone?: string | null
): string | null {
  const date = toDate(value);
  if (!date) return null;
  return safeFormat(date, timeZone, { hour: 'numeric', minute: '2-digit' }, 'time');
}

/** "Fri, October 3" in the venue's zone. */
export function formatEventDate(
  value: string | Date | null | undefined,
  timeZone?: string | null,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'long', day: 'numeric' }
): string | null {
  const date = toDate(value);
  if (!date) return null;
  return safeFormat(date, timeZone, options, 'date');
}

/** Zero-padded, so day keys compare as plain strings. */
function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * The calendar day an instant falls on in a given zone, as "YYYY-MM-DD".
 *
 * Comparing these strings is how "is this today?" and "has the event day
 * passed?" are answered without the device's own midnight getting a vote.
 *
 * Read out of a formatted date string rather than `formatToParts`, which
 * Hermes does not have. If the zone can't be applied the device's own day is
 * returned — the same answer the app gave before zones existed.
 */
export function dayKeyInZone(
  value: string | Date | null | undefined,
  timeZone?: string | null
): string | null {
  const date = toDate(value);
  if (!date) return null;

  const text = safeFormat(
    date,
    timeZone,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    'date'
  );

  if (text) {
    // "2026-10-03" on engines that answer in ISO order...
    const iso = text.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (iso) return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;

    // ...and "10/03/2026" on the ones that answer the American way.
    const us = text.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{4})/);
    if (us) return `${us[3]}-${pad(Number(us[1]))}-${pad(Number(us[2]))}`;
  }

  // Nothing parseable came back; fall back to the device's own calendar.
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Is this event's date today, as the venue counts days? */
export function isEventToday(
  value: string | Date | null | undefined,
  timeZone?: string | null,
  now: Date = new Date()
): boolean {
  const eventDay = dayKeyInZone(value, timeZone);
  if (!eventDay) return false;
  return eventDay === dayKeyInZone(now, timeZone);
}
