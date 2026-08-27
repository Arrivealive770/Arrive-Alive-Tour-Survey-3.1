import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDeviceStore } from '@/lib/state/device-store';
import { api } from '@/lib/api/api';
import type { Event } from '@/lib/api/types';

/** How often the running event is re-checked against the server. */
const POLL_MS = 60_000;

/**
 * Keeps this tablet's copy of the running event up to date.
 *
 * It only reads. It does not end events, reset anything, or navigate.
 *
 * It used to do all three. A timer checked the event's end time every twenty
 * seconds and, once past it, wiped the survey and pledge stores, cleared the
 * event and replaced the route — from a provider wrapping the entire app. Fired
 * mid-session, that pulled the kiosk stack out from under whatever screen a
 * guest was on. The likeliest way to hit it was finishing a survey: the kiosk
 * home screen refreshes the event from the server as it mounts, so the
 * thank-you screen handing back to the menu was itself what delivered the end
 * time that triggered the teardown, right in the middle of the transition.
 *
 * An event now runs until a person ends it — the crew on the tablet, or the
 * home office marking it complete. See `isEventOver` in event-status.ts.
 */
export function EventWatcher() {
  const currentEventId = useDeviceStore((s) => s.currentEventId);

  // Failures are ignored: a venue with no signal should change nothing about
  // what this tablet believes it is doing.
  const { data: serverEvent } = useQuery({
    queryKey: ['event-watch', currentEventId],
    queryFn: () => api.get<Event>(`/api/events/${currentEventId}`),
    enabled: !!currentEventId,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 0,
  });

  // Fold anything new from the server into the device store, so the menu can
  // name the area and say whether the office has closed the event off.
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
