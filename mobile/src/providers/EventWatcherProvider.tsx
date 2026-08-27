import React, { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router, useRootNavigationState } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useDeviceStore } from '@/lib/state/device-store';
import { useSurveyStore } from '@/lib/state/survey-store';
import { usePledgeStore } from '@/lib/state/pledge-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { isEventOver } from '@/lib/events/event-status';
import { api } from '@/lib/api/api';
import type { Event } from '@/lib/api/types';

/** How often the running event is re-checked against the server. */
const POLL_MS = 60_000;
/** How often the locally known end time / event day is re-checked. */
const LOCAL_TICK_MS = 20_000;

/**
 * Watches the event this device is running and, the moment it is over, sends
 * the crew back to the main menu to pick the next area.
 *
 * "Over" is decided by {@link isEventOver}. The server poll keeps the local
 * copy honest (an admin can mark an event complete mid-shift), but the local
 * tick is what makes this work at a venue with no signal.
 */
export function EventWatcher() {
  const { db } = useDatabase();

  // On a cold start the stored event can already be expired. Navigating before
  // the router has mounted is a no-op that would leave the tablet sitting on a
  // dead event, so nothing runs until the navigator exists.
  const navigationState = useRootNavigationState();
  const navigatorReady = !!navigationState?.key;

  const currentEventId = useDeviceStore((s) => s.currentEventId);
  const currentEventDate = useDeviceStore((s) => s.currentEventDate);
  const currentEventEndAt = useDeviceStore((s) => s.currentEventEndAt);
  const currentEventStatus = useDeviceStore((s) => s.currentEventStatus);
  const currentEventTimeZone = useDeviceStore((s) => s.currentEventTimeZone);

  // Guards against two timers both firing an end for the same event.
  const endingRef = useRef(false);

  useEffect(() => {
    endingRef.current = false;
  }, [currentEventId]);

  const endEvent = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;

    console.log('[EventWatcher] Event is over — returning to the main menu');

    // Drop any half-finished guest session before the screen changes, so the
    // next event doesn't inherit someone else's answers.
    useSurveyStore.getState().reset();
    usePledgeStore.getState().reset();

    useDeviceStore.getState().clearCurrentEvent();

    if (db) {
      try {
        await db.clearCurrentEvent();
      } catch (err) {
        console.error('[EventWatcher] Could not clear the local event row:', err);
      }
    }

    router.replace('/?eventEnded=1' as any);
  }, [db]);

  // Server poll. Only runs while an event is selected; failures are ignored so
  // a dead connection never ends an event that is still going.
  const { data: serverEvent } = useQuery({
    queryKey: ['event-watch', currentEventId],
    queryFn: () => api.get<Event>(`/api/events/${currentEventId}`),
    enabled: !!currentEventId,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 0,
  });

  // Fold anything new from the server back into the device store so the local
  // tick (and a later cold start) can act on it offline.
  useEffect(() => {
    if (!serverEvent || !currentEventId || serverEvent.id !== currentEventId) return;

    useDeviceStore.getState().setDeviceConfig({
      currentEventVenue: serverEvent.venueName,
      currentEventDate: serverEvent.eventDate,
      currentEventEndAt: serverEvent.eventEndAt ?? null,
      currentEventStatus: serverEvent.status,
      currentEventTimeZone: serverEvent.timeZone ?? null,
    });
  }, [serverEvent, currentEventId]);

  // Local check: on mount, on every tick, and whenever the app is brought back
  // to the foreground (timers don't fire reliably while backgrounded).
  useEffect(() => {
    if (!currentEventId || !navigatorReady) return;

    const check = () => {
      const over = isEventOver({
        status: currentEventStatus,
        eventDate: currentEventDate,
        eventEndAt: currentEventEndAt,
        timeZone: currentEventTimeZone,
      });
      if (over) {
        endEvent();
      }
    };

    check();

    const interval = setInterval(check, LOCAL_TICK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [
    currentEventId,
    navigatorReady,
    currentEventStatus,
    currentEventDate,
    currentEventEndAt,
    currentEventTimeZone,
    endEvent,
  ]);

  return null;
}

export function EventWatcherProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EventWatcher />
      {children}
    </>
  );
}
