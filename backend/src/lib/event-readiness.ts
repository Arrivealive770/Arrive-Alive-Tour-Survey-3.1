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

/**
 * How long past its scheduled end an event nobody closed is finally treated as
 * finished.
 *
 * The end time typed in the office is a plan, not a shutdown. Events run long —
 * the line is still out the door at closing time — and the crew keeps working.
 * Deleting an event's photos while a station is still handing them out is the
 * worst thing this purge could do, so the scheduled end no longer ends
 * anything on its own. A person ends the event: the facilitator on the device,
 * or the home office in this portal.
 *
 * This window is only the backstop for the night nobody remembered to close
 * it, so participant photos still don't sit on the server indefinitely.
 */
export const RUN_LONG_GRACE_MS = 6 * 60 * 60 * 1000; // 6 hours

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
 * The moment an event finished. That is when somebody ended it — not when the
 * clock ran out on the scheduled end, because events run past that and the
 * crew is still collecting. Null while it is still running.
 *
 * The one exception is {@link RUN_LONG_GRACE_MS} past the scheduled end: an
 * event left open that long was forgotten, not running.
 */
export function endedAt(event: {
  eventEndAt: Date | null;
  completedAt: Date | null;
  status: string;
  createdAt: Date;
}, now: Date): Date | null {
  if (event.status === "completed") {
    // Events completed before this column existed have no stamp; fall back to
    // the event's own record so they are treated as long finished rather than
    // as having just ended.
    return event.completedAt ?? event.createdAt;
  }

  if (event.eventEndAt && now.getTime() - event.eventEndAt.getTime() >= RUN_LONG_GRACE_MS) {
    return event.eventEndAt;
  }

  return null;
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
