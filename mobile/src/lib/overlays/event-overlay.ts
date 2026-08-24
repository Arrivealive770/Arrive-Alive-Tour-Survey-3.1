import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/api';

/**
 * The artwork the current event's photos get, as the server resolves it.
 *
 * The phone used to draw a generic badge over the camera while the server
 * applied the event's real artwork to the finished photo, so what staff framed
 * was not what the guest got. Both sides now use this one answer. Events with
 * no artwork uploaded come back with the built-in standard frame
 * (`isStandard: true`), never an error.
 */
export interface EventOverlayArtwork {
  /** null for the built-in standard frame. */
  id: string | null;
  name: string;
  url: string;
  /** "frame" = photo sits inside the window; "overlay" = art on top of the photo. */
  mode: 'overlay' | 'frame';
  window: { x: number; y: number; w: number; h: number } | null;
  width: number | null;
  height: number | null;
  isStandard: boolean;
}

const isRealEvent = (eventId?: string | null): eventId is string =>
  !!eventId && eventId !== 'no-event';

export function useEventOverlay(eventId?: string | null) {
  return useQuery({
    queryKey: ['event-overlay', eventId],
    enabled: isRealEvent(eventId),
    // Artwork changes at most once per event, and the camera screen must keep
    // working when the venue's wifi drops.
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
    queryFn: () => api.get<EventOverlayArtwork>(`/api/events/${eventId}/overlay`),
  });
}
