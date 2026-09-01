import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/api';
import { useDeviceStore } from '@/lib/state/device-store';
import { useSurveyStore } from '@/lib/state/survey-store';
import { usePledgeStore } from '@/lib/state/pledge-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import type { Event } from '@/lib/api/types';

/**
 * Ending the event by hand — the only thing that finishes an event on time.
 *
 * The scheduled end time no longer closes anything (events run long), so the
 * facilitator calls it. Telling the server is what matters: it closes the event
 * for every other tablet and phone at the venue, and starts the clock on
 * deleting the participant photos and email addresses.
 *
 * With no signal the event is still ended on this device and the crew is told
 * the office has to close it in the portal. Nothing collected is lost either
 * way — surveys and photos already queued keep syncing after the event ends.
 */
export function useEndEvent() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();
  const [isEnding, setIsEnding] = useState(false);

  const endEvent = useCallback(async () => {
    const eventId = useDeviceStore.getState().currentEventId;
    if (!eventId || isEnding) return;

    setIsEnding(true);

    let reachedServer = true;
    try {
      await api.put<Event>(`/api/events/${eventId}/complete`, {});
    } catch (err) {
      reachedServer = false;
      console.error('[EndEvent] Could not tell the server the event ended:', err);
    }

    // Drop any half-finished guest session so the next event never inherits
    // someone else's answers.
    useSurveyStore.getState().reset();
    usePledgeStore.getState().reset();

    useDeviceStore.getState().clearCurrentEvent();

    if (db) {
      try {
        await db.clearCurrentEvent();
      } catch (err) {
        console.error('[EndEvent] Could not clear the local event row:', err);
      }
    }

    // The event list on the setup screen must not still offer this event.
    queryClient.invalidateQueries({ queryKey: ['events'] });

    setIsEnding(false);
    router.replace(`/?eventEnded=${reachedServer ? 'manual' : 'offline'}` as any);
  }, [db, isEnding, queryClient]);

  return { endEvent, isEnding };
}
