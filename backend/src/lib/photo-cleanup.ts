import { prisma } from "../prisma";

/**
 * A phone's original photo that is now safe to delete locally.
 */
export interface DeletablePhoneOriginal {
  id: string;
  localId: string;
  storageKey: string | null;
}

/**
 * Compute which of a phone's captured original photos are safe to delete
 * locally, for a given team+event.
 *
 * Safety rule: a photo is deletable ONLY once EVERY active tablet on the team
 * (deviceType "tablet", isActive true) has acknowledged receipt (a PhotoReceipt
 * row). If the team has 0 active tablets, nothing is deletable (we must never
 * lose a photo that never reached a tablet).
 *
 * Also excludes photos already marked phoneOriginalDeleted (the phone confirmed
 * cleanup) and photos with status "deleted".
 */
export async function getDeletablePhoneOriginals(params: {
  teamId: string;
  eventId: string;
  phoneDeviceId: string;
}): Promise<DeletablePhoneOriginal[]> {
  const { teamId, eventId, phoneDeviceId } = params;

  // Active tablets on the team.
  const activeTablets = await prisma.device.findMany({
    where: { teamId, deviceType: "tablet", isActive: true },
    select: { id: true },
  });

  // No tablets -> never signal delete.
  if (activeTablets.length === 0) return [];

  const requiredTabletIds = activeTablets.map((t) => t.id);

  // Candidate photos: captured by this phone, for this team+event, still
  // available/in-flight (not deleted), and not already cleaned up on the phone.
  const candidates = await prisma.photo.findMany({
    where: {
      teamId,
      eventId,
      captureDeviceId: phoneDeviceId,
      phoneOriginalDeleted: false,
      status: { not: "deleted" },
    },
    select: {
      id: true,
      localId: true,
      storageKey: true,
      receipts: {
        where: { deviceId: { in: requiredTabletIds } },
        select: { deviceId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Keep only photos received by ALL required (active) tablets.
  return candidates
    .filter((p) => {
      const receivedTabletIds = new Set(p.receipts.map((r) => r.deviceId));
      return requiredTabletIds.every((id) => receivedTabletIds.has(id));
    })
    .map((p) => ({ id: p.id, localId: p.localId, storageKey: p.storageKey }));
}
