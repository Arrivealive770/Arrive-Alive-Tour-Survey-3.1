import { prisma } from "../prisma";

/**
 * Repairs events whose chosen overlay was written into the wrong column.
 *
 * The admin portal's overlay dropdown holds overlay IDs, but the event form
 * used to send that value as `overlayType` — the legacy slug column — and never
 * as `overlayId`. Artwork is resolved through the `overlayId` relation, so it
 * stayed null and every event fell back to the standard frame. Staff picked an
 * overlay, saw it saved, and the phones never got it.
 *
 * The form is fixed, but events created before the fix still carry the id in
 * the wrong place. Runs on boot because the desktop deployment has nobody to
 * run a migration by hand.
 *
 * Safe to run repeatedly: it only touches rows whose `overlayId` is null and
 * whose `overlayType` matches a real overlay row, and it leaves `overlayType`
 * alone so nothing that still reads the slug changes underneath.
 */
export async function backfillEventOverlayIds(): Promise<number> {
  const candidates = await prisma.event.findMany({
    where: { overlayId: null },
    select: { id: true, venueName: true, overlayType: true },
  });

  if (candidates.length === 0) return 0;

  // Only ids that name a real overlay. Genuine slugs ("alcohol", "default")
  // simply won't match, which is exactly the behaviour we want.
  const overlayIds = new Set(
    (await prisma.overlay.findMany({ select: { id: true } })).map((o) => o.id)
  );

  const repairable = candidates.filter((e) => overlayIds.has(e.overlayType));
  if (repairable.length === 0) return 0;

  for (const event of repairable) {
    await prisma.event.update({
      where: { id: event.id },
      data: { overlayId: event.overlayType },
    });
    console.log(
      `[OverlayBackfill] Restored artwork for "${event.venueName}" (overlay ${event.overlayType})`
    );
  }

  console.log(
    `[OverlayBackfill] Reconnected ${repairable.length} event(s) to their chosen overlay`
  );
  return repairable.length;
}
