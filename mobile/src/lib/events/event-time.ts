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
 */

/** The tablet's own zone — the fallback when an event has no zone recorded. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  } catch {
    return 'America/Chicago';
  }
}

function zoneOrDevice(timeZone?: string | null): string {
  return timeZone && timeZone.trim() ? timeZone : deviceTimeZone();
}

/**
 * Format an instant in a specific zone, falling back to the device zone if the
 * platform rejects it (an unknown zone name throws on some Android builds).
 */
function formatInZone(
  value: string | Date | null | undefined,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return date.toLocaleString('en-US', { ...options, timeZone: zoneOrDevice(timeZone) });
  } catch {
    return date.toLocaleString('en-US', options);
  }
}

/** "9:00 PM" in the venue's zone. */
export function formatEventTime(
  value: string | Date | null | undefined,
  timeZone?: string | null
): string | null {
  return formatInZone(value, timeZone, { hour: 'numeric', minute: '2-digit' });
}

/** "Fri, October 3" in the venue's zone. */
export function formatEventDate(
  value: string | Date | null | undefined,
  timeZone?: string | null,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'long', day: 'numeric' }
): string | null {
  return formatInZone(value, timeZone, options);
}

/**
 * The calendar day an instant falls on in a given zone, as "YYYY-MM-DD".
 *
 * Comparing these strings is how "is this today?" and "has the event day
 * passed?" are answered without the device's own midnight getting a vote.
 */
export function dayKeyInZone(
  value: string | Date | null | undefined,
  timeZone?: string | null
): string | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: zoneOrDevice(timeZone),
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
  }

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');

  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
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
