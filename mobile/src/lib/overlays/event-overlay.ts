import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  loadEventOverlay,
  readCachedOverlay,
  type EventOverlayArtwork,
} from '@/lib/overlays/overlay-cache';

/**
 * The artwork the current event's photos get, as the server resolves it.
 *
 * The phone used to draw a generic badge over the camera while the server
 * applied the event's real artwork to the finished photo, so what staff framed
 * was not what the guest got. Both sides now use this one answer. Events with
 * no artwork uploaded come back with the built-in standard frame
 * (`isStandard: true`), never an error.
 *
 * The artwork is stored on the device (see overlay-cache), so this keeps
 * answering after the signal goes. The stored copy is handed back immediately
 * on open rather than after a round trip, because a camera that shows the wrong
 * frame for its first second is a camera staff will shoot through.
 */
export type { EventOverlayArtwork };

const isRealEvent = (eventId?: string | null): eventId is string =>
  !!eventId && eventId !== 'no-event';

export function useEventOverlay(eventId?: string | null) {
  // What is already on this device, read straight from storage.
  const [stored, setStored] = useState<EventOverlayArtwork | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!isRealEvent(eventId)) {
      setStored(undefined);
      return;
    }
    readCachedOverlay(eventId)
      .then((artwork) => {
        if (!cancelled && artwork) setStored(artwork);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const query = useQuery({
    queryKey: ['event-overlay', eventId],
    enabled: isRealEvent(eventId),
    // Artwork changes at most once per event, and the camera screen must keep
    // working when the venue's wifi drops.
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
    queryFn: () => loadEventOverlay(eventId as string),
  });

  // Fresh answer wins; the stored copy covers the gap before it arrives and
  // the case where it never does.
  return { ...query, data: query.data ?? stored };
}
