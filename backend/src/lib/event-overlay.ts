import { readFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { prisma } from "../prisma";
import { storedFilenameFor } from "./file-storage";
import {
  detectFrameWindow,
  resolveMode,
  windowFromOverlay,
  type WindowRect,
} from "./overlay-frame";
import {
  STANDARD_OVERLAY_NAME,
  STANDARD_OVERLAY_SIZE,
  STANDARD_OVERLAY_WINDOW,
  getStandardOverlayBuffer,
  getStandardOverlayUrl,
} from "./standard-overlay";

/**
 * "Which artwork does this event's photos get?" answered in one place.
 *
 * The phone needs it to show the guest what the finished photo will look like
 * while the shot is being lined up, and the compositing route needs it to make
 * that photo. They used to disagree — the phone drew a generic badge and the
 * server applied the event's real overlay — so what staff framed was not what
 * came out. Both now go through here, and an event with no artwork uploaded
 * falls back to the standard frame instead of failing.
 */
export interface OverlayArtwork {
  /** null for the built-in standard frame, which has no database row. */
  id: string | null;
  name: string;
  url: string;
  /** Already resolved: never "auto". */
  mode: "overlay" | "frame";
  /** Where the photo sits inside the frame. Null in "overlay" mode. */
  window: WindowRect | null;
  width: number | null;
  height: number | null;
  isStandard: boolean;
}

/** Overlay row fields this module needs. Keeps callers free to select more. */
interface OverlayRow {
  id: string;
  name: string;
  url: string;
  mode: string;
  isActive: boolean;
  windowX: number | null;
  windowY: number | null;
  windowW: number | null;
  windowH: number | null;
}

const UPLOADS_DIR = join(process.cwd(), "uploads");

// Resolving an overlay means decoding it (to tell a transparent overlay from a
// polaroid frame, and to find the window). The phones ask for this on every
// camera screen, so the answer is remembered per overlay row.
const resolvedCache = new Map<string, OverlayArtwork>();

export function forgetResolvedOverlay(overlayId: string): void {
  resolvedCache.delete(overlayId);
}

/**
 * Read overlay bytes. Files we stored ourselves are read straight off disk —
 * the server asking itself over HTTP for its own file is a needless round trip
 * and fails whenever BACKEND_URL is not reachable from the machine itself.
 */
export async function loadOverlayBuffer(artwork: {
  url: string;
  isStandard: boolean;
}): Promise<Buffer> {
  if (artwork.isStandard) return getStandardOverlayBuffer();

  const filename = artwork.url.includes("/uploads/")
    ? storedFilenameFor(artwork.url)
    : null;
  if (filename) {
    try {
      return await readFile(join(UPLOADS_DIR, filename));
    } catch {
      // Fall through to the network path below.
    }
  }

  const response = await fetch(artwork.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch overlay (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** The built-in frame, used whenever an event has no artwork of its own. */
export async function standardOverlayArtwork(): Promise<OverlayArtwork> {
  return {
    id: null,
    name: STANDARD_OVERLAY_NAME,
    url: await getStandardOverlayUrl(),
    mode: "frame",
    window: STANDARD_OVERLAY_WINDOW,
    width: STANDARD_OVERLAY_SIZE.width,
    height: STANDARD_OVERLAY_SIZE.height,
    isStandard: true,
  };
}

/**
 * Turn an overlay row into everything a client needs to draw it: the real mode
 * (not "auto"), the window rect, and the artwork's pixel size. A window that
 * had to be detected is written back so it is only ever worked out once.
 */
export async function resolveOverlayArtwork(overlay: OverlayRow): Promise<OverlayArtwork> {
  const cached = resolvedCache.get(overlay.id);
  if (cached && cached.url === overlay.url) return cached;

  const buffer = await loadOverlayBuffer({ url: overlay.url, isStandard: false });
  const metadata = await sharp(buffer).metadata();
  const mode = resolveMode(overlay.mode, !!metadata.hasAlpha);

  let window = windowFromOverlay(overlay);
  if (mode === "frame" && !window) {
    window = await detectFrameWindow(buffer);
    await prisma.overlay
      .update({
        where: { id: overlay.id },
        data: { windowX: window.x, windowY: window.y, windowW: window.w, windowH: window.h },
      })
      .catch((err) => console.error("[Overlay] Failed to cache window:", err));
  }

  const artwork: OverlayArtwork = {
    id: overlay.id,
    name: overlay.name,
    url: overlay.url,
    mode,
    window: mode === "frame" ? window : null,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    isStandard: false,
  };

  resolvedCache.set(overlay.id, artwork);
  return artwork;
}

/**
 * The artwork an event's photos should use. Returns null only when the event
 * itself does not exist — an event with no overlay assigned, or one pointing at
 * artwork that has since been deleted or switched off, gets the standard frame.
 */
export async function overlayForEvent(eventId: string): Promise<OverlayArtwork | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { overlay: true },
  });
  if (!event) return null;

  const overlay = event.overlay;
  if (!overlay || !overlay.isActive) return standardOverlayArtwork();

  try {
    return await resolveOverlayArtwork(overlay);
  } catch (error) {
    // Unreadable artwork should not stop the tour: brand the photo with the
    // standard frame and leave a trail for whoever uploaded the bad file.
    console.error(`[Overlay] Could not read overlay ${overlay.id}:`, error);
    return standardOverlayArtwork();
  }
}
