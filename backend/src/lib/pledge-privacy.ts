import { unlink } from "fs/promises";
import { join } from "path";
import { prisma } from "../prisma";

/**
 * Participant-data deletion.
 *
 * Everything that erases a participant's email address or photo lives here so
 * there is exactly one implementation, used by:
 *   - the email queue processor, right after a photo is delivered
 *   - DELETE /api/photos/purge/:eventId and DELETE /api/pledges/purge/:eventId
 *   - the scheduled end-of-event purge (src/lib/event-purge.ts)
 *
 * Survey responses are never touched by anything in this file. They are
 * anonymous by construction (no link to a pledge exists) and are the one thing
 * the tour keeps.
 */

const UPLOADS_DIR = join(process.cwd(), "uploads");

/**
 * Delete a previously-uploaded file from storage.vibecodeapp.com.
 * Best-effort: logs but never throws, so a purge always runs to completion.
 */
export async function deleteFromRemoteStorage(fileUrl: string): Promise<void> {
  try {
    // storage.vibecodeapp.com URLs look like
    // https://storage.vibecodeapp.com/.../<fileId>/<filename>
    const match = fileUrl.match(/storage\.vibecodeapp\.com\/.*?\/([^/]+)\/[^/]+$/);
    const fileId = match?.[1];
    if (!fileId) return;
    await fetch(`https://storage.vibecodeapp.com/v1/files/${fileId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("[Privacy] Failed to delete remote file:", fileUrl, error);
  }
}

/**
 * Remove the image bytes for one photo: the original on local disk and the
 * finished (overlaid) copy in remote storage. Never throws.
 */
export async function deletePhotoFiles(photo: {
  storageKey: string | null;
  finishedPhotoUrl: string | null;
}): Promise<void> {
  if (photo.storageKey) {
    try {
      await unlink(join(UPLOADS_DIR, photo.storageKey));
    } catch {
      // Already gone — that is the desired end state anyway.
    }
  }
  if (photo.finishedPhotoUrl) {
    await deleteFromRemoteStorage(photo.finishedPhotoUrl);
  }
}

/**
 * Delete every photo belonging to an event.
 *
 * The rows are kept but marked "deleted" with a `deletedAt` stamp: that is what
 * GET /api/photos/deleted/:teamId/:eventId serves, and it is how the phone and
 * both tablets learn to drop their local copies. `storageKey` is kept for the
 * same reason — it is the filename each device stored locally. The image bytes
 * themselves are gone from the server by the time this returns.
 */
export async function purgeEventPhotos(eventId: string): Promise<{ purgedCount: number }> {
  const photos = await prisma.photo.findMany({
    where: { eventId, status: { not: "deleted" } },
    select: { id: true, storageKey: true, finishedPhotoUrl: true },
  });

  for (const photo of photos) {
    await deletePhotoFiles(photo);
  }

  const result = await prisma.photo.updateMany({
    where: { eventId, status: { not: "deleted" } },
    data: {
      status: "deleted",
      deletedAt: new Date(),
      // Drop the URLs: nothing should be able to fetch the image again.
      storageUrl: null,
      finishedPhotoUrl: null,
    },
  });

  return { purgedCount: result.count };
}

export interface PledgeEmailPurgeResult {
  purgedPledgeCount: number;
  purgedQueuedEmailCount: number;
  survivingSurveyResponseCount: number;
}

/**
 * Erase every participant email address recorded for an event.
 *
 * Pledge rows are deleted outright (they exist only to carry the address and
 * the photo link), which cascades away any EmailQueue rows still holding an
 * unsent address. Survey responses cannot be reached from here — there is no
 * foreign key between the two — so the answers survive; the count is returned
 * as proof.
 */
export async function purgeEventPledgeEmails(
  eventId: string
): Promise<PledgeEmailPurgeResult> {
  // Counted before deleting so the response reports what was actually removed.
  const purgedQueuedEmailCount = await prisma.emailQueue.count({
    where: { pledge: { eventId } },
  });

  const deleted = await prisma.pledge.deleteMany({ where: { eventId } });

  const survivingSurveyResponseCount = await prisma.surveyResponse.count({
    where: { eventId },
  });

  return {
    purgedPledgeCount: deleted.count,
    purgedQueuedEmailCount,
    survivingSurveyResponseCount,
  };
}

export interface EventPurgeResult {
  eventId: string;
  purgedPhotoCount: number;
  purgedPledgeCount: number;
  purgedQueuedEmailCount: number;
  survivingSurveyResponseCount: number;
}

/**
 * Full end-of-event purge: photos first, then email addresses.
 *
 * Photos go first on purpose. Pledge.photoId is onDelete: SetNull, so if the
 * second step failed we would be left with addresses but no photos (recoverable
 * by re-running) rather than photos nobody can account for.
 */
export async function purgeEventParticipantData(
  eventId: string
): Promise<EventPurgeResult> {
  const photos = await purgeEventPhotos(eventId);
  const pledges = await purgeEventPledgeEmails(eventId);

  await prisma.event.update({
    where: { id: eventId },
    data: { photosPurgedAt: new Date() },
  });

  return {
    eventId,
    purgedPhotoCount: photos.purgedCount,
    purgedPledgeCount: pledges.purgedPledgeCount,
    purgedQueuedEmailCount: pledges.purgedQueuedEmailCount,
    survivingSurveyResponseCount: pledges.survivingSurveyResponseCount,
  };
}

/**
 * Called the instant a pledge photo has been delivered to the participant.
 *
 * Deletes, in this order:
 *   1. the EmailQueue row  — it holds a copy of the address and the photo URL
 *   2. the address on the Pledge row — blanked, row kept so counts still work
 *   3. the photo itself — only when the participant's copy is self-contained
 *
 * Step 3 is conditional: `photoWasEmbedded` is true only when the image was
 * attached to the email rather than linked. If the send fell back to a link,
 * deleting the file now would leave the participant with a broken image, so the
 * photo waits for the end-of-event purge instead.
 */
export async function scrubPledgeAfterSend(params: {
  pledgeId: string;
  emailQueueId: string;
  photoWasEmbedded: boolean;
}): Promise<{ emailErased: boolean; photoDeleted: boolean }> {
  const { pledgeId, emailQueueId, photoWasEmbedded } = params;

  const pledge = await prisma.pledge.findUnique({
    where: { id: pledgeId },
    select: { photoId: true },
  });

  // The queue row carries toEmail + photoUrl; nothing needs it after a send.
  await prisma.emailQueue.delete({ where: { id: emailQueueId } }).catch(() => {
    // Already deleted (e.g. a retry raced us). Nothing to clean up.
  });

  await prisma.pledge.update({
    where: { id: pledgeId },
    data: {
      email: "",
      emailPurgedAt: new Date(),
      emailStatus: "sent",
      emailSentAt: new Date(),
      emailError: null,
    },
  });

  let photoDeleted = false;
  if (photoWasEmbedded && pledge?.photoId) {
    const photo = await prisma.photo.findUnique({
      where: { id: pledge.photoId },
      select: { id: true, storageKey: true, finishedPhotoUrl: true, status: true },
    });

    if (photo && photo.status !== "deleted") {
      await deletePhotoFiles(photo);
      await prisma.photo.update({
        where: { id: photo.id },
        data: {
          status: "deleted",
          deletedAt: new Date(),
          sentAt: new Date(),
          usedAt: new Date(),
          storageUrl: null,
          finishedPhotoUrl: null,
        },
      });
      photoDeleted = true;
    }
  }

  return { emailErased: true, photoDeleted };
}
