import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from '@/lib/api/api';
import type { Event } from '@/lib/api/types';

/**
 * Events a crew ended while the server couldn't be reached.
 *
 * Ending an event offline still ends it on the device straight away (see
 * useEndEvent). The server has to hear about it too — that is what closes the
 * event for the other tablets and the admin site — so the id is kept here and
 * sent by the sync service once the server answers again, the same way queued
 * surveys are.
 */
const STORAGE_KEY = 'pending-event-completions-v1';

async function read(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function write(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export async function queueEventCompletion(eventId: string): Promise<void> {
  const ids = await read();
  if (!ids.includes(eventId)) {
    await write([...ids, eventId]);
  }
}

export async function getPendingEventCompletionCount(): Promise<number> {
  return (await read()).length;
}

/** Ended here but not yet on the server, so a stored event list still shows them. */
export async function getPendingEventCompletionIds(): Promise<string[]> {
  return read();
}

/**
 * Tell the server about every event ended offline. Returns how many are still
 * waiting. Stops at the first connection failure: if one can't get through,
 * the rest won't either.
 */
export async function sendPendingEventCompletions(): Promise<number> {
  const ids = await read();
  if (ids.length === 0) return 0;

  const remaining = [...ids];
  for (const eventId of ids) {
    try {
      await api.put<Event>(`/api/events/${eventId}/complete`, {});
      console.log(`[EventCompletions] Server told event ${eventId} ended`);
    } catch (error) {
      // The server answered and refused (event deleted, already gone). Sending
      // it again won't change that answer, so let it go.
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        console.warn(`[EventCompletions] Server refused ending ${eventId}:`, error.message);
      } else {
        break;
      }
    }
    remaining.splice(remaining.indexOf(eventId), 1);
  }

  if (remaining.length !== ids.length) {
    // Re-read so an event ended while this was running isn't dropped.
    const latest = await read();
    const sent = new Set(ids.filter((id) => !remaining.includes(id)));
    await write(latest.filter((id) => !sent.has(id)));
  }

  return remaining.length;
}
