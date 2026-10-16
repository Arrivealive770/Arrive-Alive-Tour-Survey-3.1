/**
 * Collecting with no event picked.
 *
 * A tablet that hasn't got the latest event list — never synced at the office,
 * or the event was made after it went offline — must still be able to collect.
 * The crew picks "no event" instead, and surveys are tagged with this id. The
 * server files them under the team's "No Event" holding event
 * (backend/src/lib/no-event.ts), where the office can find them.
 *
 * Only anonymous survey answers are collected this way. Pledges and photos
 * carry participant emails and pictures, and those are deleted when their
 * event ends — with no event there is nothing to end, so they stay off.
 */

import type { DatabaseService } from '@/lib/db';
import { useDeviceStore } from '@/lib/state/device-store';

export const NO_EVENT_ID = 'no-event';

export function isNoEvent(eventId: string | null | undefined): boolean {
  return eventId === NO_EVENT_ID;
}

export async function startWithoutEvent(db: DatabaseService | null): Promise<void> {
  const { teamId, teamCode, setCurrentEvent, setDeviceConfig } = useDeviceStore.getState();

  setCurrentEvent(NO_EVENT_ID);
  setDeviceConfig({
    picturePledgeEnabled: false,
    currentEventOverlayId: null,
    currentEventVenue: null,
    currentEventDate: null,
    currentEventEndAt: null,
    currentEventStatus: null,
  });

  if (db) {
    await db.setCurrentEvent({
      eventId: NO_EVENT_ID,
      teamId: teamId ?? 'unknown',
      teamCode: teamCode,
      venueName: '',
      // The kiosk offers every survey on the device instead (kiosk/index.tsx).
      surveyTypes: '[]',
      overlayType: 'default',
      activeSurveyType: null,
      startedAt: new Date().toISOString(),
    });
  }
}
