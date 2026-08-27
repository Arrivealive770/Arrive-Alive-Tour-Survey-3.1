import { prisma } from "../prisma";

/**
 * "Has everything from this event actually reached the server yet?"
 *
 * The end-of-event purge deletes photos and participant email addresses. If it
 * fires while a tablet is still holding surveys it has not uploaded, or while a
 * pledge email is still queued, the tour loses answers it collected and a
 * participant never gets the photo they were promised.
 *
 * So a purge waits for:
 *   - a short settling period after the event ends
 *   - every device that worked this event to check in since it ended
 *   - the phone-to-tablet photo handoffs to finish
 *   - the pledge emails to leave the queue
 *
 * ...but never longer than {@link MAX_WAIT_MS}. A tablet that stays in a bag
 * for a week cannot be allowed to keep participant photos alive on the server
 * indefinitely — the privacy promise wins over the last few uploads.
 */

/** Quiet time after the end before anything is deleted. */
const SETTLE_MS = 10 * 60 * 1000; // 10 minutes

/** Hard ceiling: after this the purge runs whatever is still outstanding. */
export const MAX_WAIT_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface EventReadiness {
  eventId: string;
  /** When the event finished, or null if it hasn't. */
  endedAt: Date | null;
  /** The event is over — its end time passed, or it was marked completed. */
  isOver: boolean;
  /** Nothing is outstanding, or the deadline has been reached. */
  ready: boolean;
  /** Ready only because MAX_WAIT_MS elapsed, with uploads still missing. */
  forced: boolean;
  /** Plain-English list of what is still being waited on. */
  waitingOn: string[];
  pending: {
    unsyncedLocalPhotos: number;
    photosMidDelivery: number;
    queuedEmails: number;
    pledgesAwaitingEmail: number;
    devicesNotCheckedIn: number;
  };
}

/**
 * The moment an event finished: its scheduled end, or when staff marked it
 * completed, whichever came first. Null while it is still running.
 */
function endedAt(event: {
  eventEndAt: Date | null;
  completedAt: Date | null;
  status: string;
  createdAt: Date;
}, now: Date): Date | null {
  const candidates: Date[] = [];

  if (event.eventEndAt && event.eventEndAt <= now) candidates.push(event.eventEndAt);
  if (event.status === "completed") {
    // Events completed before this column existed have no stamp; fall back to
    // the event's own record so they are treated as long finished rather than
    // as having just ended.
    candidates.push(event.completedAt ?? event.createdAt);
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((earliest, date) => (date < earliest ? date : earliest));
}

/** What is still outstanding for one event, and whether the purge may run. */
export async function describeEventReadiness(
  eventId: string,
  now: Date = new Date()
): Promise<EventReadiness | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      teamId: true,
      eventEndAt: true,
      completedAt: true,
      status: true,
      createdAt: true,
    },
  });

  if (!event) return null;

  const ended = endedAt(event, now);

  const [unsyncedLocalPhotos, photosMidDelivery, queuedEmails, pledgesAwaitingEmail] =
    await Promise.all([
      // A photo taken on a phone that has not reached a tablet yet.
      prisma.localPhoto.count({ where: { eventId, syncedToTablet: false } }),
      // Somebody picked this photo and it is being overlaid / sent right now.
      prisma.photo.count({ where: { eventId, status: { in: ["selected", "processing"] } } }),
      // A pledge email still waiting its turn, or being sent.
      prisma.emailQueue.count({
        where: { pledge: { eventId }, status: { in: ["pending", "processing"] } },
      }),
      // A pledge the queue has not picked up yet.
      prisma.pledge.count({ where: { eventId, emailStatus: { in: ["pending", "queued"] } } }),
    ]);

  // Only devices that actually worked this event matter. A tablet that sat out
  // the night has nothing of this event's to upload, so waiting on it would
  // stall the purge for no reason.
  const [surveyDevices, photoDevices, localPhotoDevices] = await Promise.all([
    prisma.surveyResponse.findMany({
      where: { eventId, deviceId: { not: null } },
      select: { deviceId: true },
      distinct: ["deviceId"],
    }),
    prisma.photo.findMany({
      where: { eventId, captureDeviceId: { not: null } },
      select: { captureDeviceId: true },
      distinct: ["captureDeviceId"],
    }),
    prisma.localPhoto.findMany({
      where: { eventId },
      select: { deviceId: true },
      distinct: ["deviceId"],
    }),
  ]);

  const deviceIds = [
    ...new Set(
      [
        ...surveyDevices.map((d) => d.deviceId),
        ...photoDevices.map((d) => d.captureDeviceId),
        ...localPhotoDevices.map((d) => d.deviceId),
      ].filter((id): id is string => !!id)
    ),
  ];

  // "Checked in since the event ended" is the proof that a device has nothing
  // left to send: the app pings the server at the end of every sync pass, so a
  // stale timestamp means the device is off or offline, not merely idle.
  const devicesNotCheckedIn = ended
    ? await prisma.device.count({
        where: {
          id: { in: deviceIds },
          isActive: true,
          OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: ended } }],
        },
      })
    : 0;

  const waitingOn: string[] = [];
  if (unsyncedLocalPhotos > 0) {
    waitingOn.push(`${unsyncedLocalPhotos} photo(s) still on a phone`);
  }
  if (photosMidDelivery > 0) {
    waitingOn.push(`${photosMidDelivery} photo(s) mid-delivery`);
  }
  if (queuedEmails > 0) {
    waitingOn.push(`${queuedEmails} pledge email(s) still to send`);
  }
  if (pledgesAwaitingEmail > 0) {
    waitingOn.push(`${pledgesAwaitingEmail} pledge(s) not emailed yet`);
  }
  if (devicesNotCheckedIn > 0) {
    waitingOn.push(`${devicesNotCheckedIn} device(s) yet to finish uploading`);
  }

  const isOver = ended !== null;
  const settled = ended !== null && now.getTime() - ended.getTime() >= SETTLE_MS;
  const deadlinePassed = ended !== null && now.getTime() - ended.getTime() >= MAX_WAIT_MS;

  if (isOver && !settled) {
    waitingOn.unshift("settling period after the event ended");
  }

  const allClear = isOver && settled && waitingOn.length === 0;

  return {
    eventId,
    endedAt: ended,
    isOver,
    ready: allClear || deadlinePassed,
    forced: deadlinePassed && !allClear,
    waitingOn,
    pending: {
      unsyncedLocalPhotos,
      photosMidDelivery,
      queuedEmails,
      pledgesAwaitingEmail,
      devicesNotCheckedIn,
    },
  };
}
