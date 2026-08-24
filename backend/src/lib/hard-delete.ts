import { prisma } from "../prisma";
import { deletePhotoFiles } from "./pledge-privacy";

/**
 * Permanent removal of a whole event or a whole team.
 *
 * This is a different thing from the participant-data purge in
 * pledge-privacy.ts. A purge deliberately KEEPS every survey answer — it only
 * erases photos and email addresses. Deleting an event or a team takes the
 * survey answers with it, because every response carries an eventId and a
 * teamId and the schema cascades from both.
 *
 * That makes a team deletion the single most destructive action in the product:
 * removing one team erases every event it ever ran and every response it ever
 * collected, across every tour date. So each function here comes in two halves —
 * a `describe*` that reports exactly what would be lost, and a `delete*` that
 * does it. The admin portal always calls describe first and shows the numbers,
 * and the routes require a typed confirmation. Neither is optional politeness:
 * the counts are the only warning anyone gets, and the rows are unrecoverable
 * short of a nightly backup.
 *
 * Image files are unlinked BEFORE the database rows go, because the rows are
 * what tell us which files exist. Delete the rows first and the photos are
 * orphaned on disk forever, still holding participants' faces.
 */

export interface EventDeletionImpact {
  eventId: string;
  venueName: string;
  venueCity: string;
  venueState: string;
  eventDate: string;
  teamName: string | null;
  surveyResponseCount: number;
  pledgeCount: number;
  photoCount: number;
  externalImportCount: number;
}

export interface TeamDeletionImpact {
  teamId: string;
  name: string;
  code: string;
  deviceCount: number;
  eventCount: number;
  surveyResponseCount: number;
  pledgeCount: number;
  photoCount: number;
}

/** What would be lost by deleting this event? Null if it does not exist. */
export async function describeEventDeletion(
  eventId: string
): Promise<EventDeletionImpact | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      venueName: true,
      venueCity: true,
      venueState: true,
      eventDate: true,
      team: { select: { name: true } },
      _count: {
        select: {
          surveyResponses: true,
          pledges: true,
          photos: true,
          externalSurveyImports: true,
        },
      },
    },
  });

  if (!event) return null;

  return {
    eventId: event.id,
    venueName: event.venueName,
    venueCity: event.venueCity,
    venueState: event.venueState,
    eventDate: event.eventDate.toISOString(),
    teamName: event.team?.name ?? null,
    surveyResponseCount: event._count.surveyResponses,
    pledgeCount: event._count.pledges,
    photoCount: event._count.photos,
    externalImportCount: event._count.externalSurveyImports,
  };
}

/**
 * Delete an event and everything attached to it. Returns what was removed.
 * Throws if the event no longer exists.
 */
export async function deleteEventCompletely(
  eventId: string
): Promise<EventDeletionImpact> {
  const impact = await describeEventDeletion(eventId);
  if (!impact) {
    throw new Error(`Event ${eventId} not found`);
  }

  await deletePhotoFilesForWhere({ eventId });

  // Cascades handle surveyResponses, pledges, photos, localPhotos and
  // external imports — see the relations in prisma/schema.prisma.
  await prisma.event.delete({ where: { id: eventId } });

  return impact;
}

/** What would be lost by deleting this team? Null if it does not exist. */
export async function describeTeamDeletion(
  teamId: string
): Promise<TeamDeletionImpact | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      code: true,
      _count: {
        select: {
          devices: true,
          events: true,
          surveyResponses: true,
          pledges: true,
          photos: true,
        },
      },
    },
  });

  if (!team) return null;

  return {
    teamId: team.id,
    name: team.name,
    code: team.code,
    deviceCount: team._count.devices,
    eventCount: team._count.events,
    surveyResponseCount: team._count.surveyResponses,
    pledgeCount: team._count.pledges,
    photoCount: team._count.photos,
  };
}

/**
 * Delete a team, every event it ran, and every response, pledge, photo and
 * device belonging to it. Returns what was removed.
 * Throws if the team no longer exists.
 */
export async function deleteTeamCompletely(
  teamId: string
): Promise<TeamDeletionImpact> {
  const impact = await describeTeamDeletion(teamId);
  if (!impact) {
    throw new Error(`Team ${teamId} not found`);
  }

  await deletePhotoFilesForWhere({ teamId });

  await prisma.team.delete({ where: { id: teamId } });

  return impact;
}

/**
 * Unlink the image bytes for every photo matching `where`.
 *
 * Batched rather than loaded in one go: a season's worth of photos for a team
 * is a lot of rows to hold in memory at once, and this runs on a desktop that
 * is also serving tablets.
 */
async function deletePhotoFilesForWhere(where: {
  eventId?: string;
  teamId?: string;
}): Promise<void> {
  const BATCH = 200;
  let cursor: string | undefined;

  for (;;) {
    const photos = await prisma.photo.findMany({
      where,
      select: { id: true, storageKey: true, finishedPhotoUrl: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (photos.length === 0) break;

    for (const photo of photos) {
      // Never throws, by design — one unreadable file must not abandon the
      // delete half-done, with rows gone and the rest of the images orphaned.
      await deletePhotoFiles(photo);
    }

    if (photos.length < BATCH) break;
    cursor = photos[photos.length - 1]!.id;
  }
}
