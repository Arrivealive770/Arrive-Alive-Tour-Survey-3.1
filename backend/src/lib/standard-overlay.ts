import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { publicUrlFor } from "./file-storage";
import type { WindowRect } from "./overlay-frame";

/**
 * The fallback pledge frame.
 *
 * Every event is supposed to have its own artwork uploaded, but events get
 * created in a hurry at the venue and the artwork often shows up later. Without
 * a fallback the phone had nothing to line the shot up against and the finished
 * photo came back unbranded (or, worse, the composite failed outright). This
 * module draws one plain Arrive Alive frame so there is always something.
 *
 * It is generated rather than shipped as a binary asset so the repo stays free
 * of large files and the artwork can be tweaked here in one place. Bump the
 * version in the filename whenever the drawing below changes, otherwise servers
 * that already wrote the old file would keep serving it.
 */

const STANDARD_OVERLAY_FILENAME = "standard-overlay-v1.png";
const UPLOADS_DIR = join(process.cwd(), "uploads");

export const STANDARD_OVERLAY_NAME = "Arrive Alive (standard)";
export const STANDARD_OVERLAY_SIZE = { width: 1080, height: 1350 };

/** Where the guest's photo lands inside the frame, as fractions of the frame. */
export const STANDARD_OVERLAY_WINDOW: WindowRect = {
  x: 60 / 1080,
  y: 68 / 1350,
  w: 960 / 1080,
  h: 900 / 1350,
};

// White border with a see-through hole in the middle (fill-rule evenodd), the
// hole being the window rect above, plus the tour wordmark underneath it.
const STANDARD_OVERLAY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <path
    d="M0,0 H1080 V1350 H0 Z M60,68 H1020 V968 H60 Z"
    fill="#ffffff"
    fill-rule="evenodd"
  />
  <rect x="56" y="64" width="968" height="908" fill="none" stroke="#e4e4e7" stroke-width="8" />
  <rect x="60" y="1000" width="180" height="10" fill="#d61f26" />
  <text
    x="540" y="1120"
    font-family="Helvetica, Arial, sans-serif" font-size="80" font-weight="bold"
    letter-spacing="4" text-anchor="middle" fill="#18181b"
  >ARRIVE ALIVE TOUR</text>
  <text
    x="540" y="1196"
    font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="normal"
    letter-spacing="2" text-anchor="middle" fill="#71717a"
  >I PLEDGE TO DRIVE SAFE</text>
  <text
    x="540" y="1288"
    font-family="Helvetica, Arial, sans-serif" font-size="42" font-weight="bold"
    letter-spacing="1" text-anchor="middle" fill="#d61f26"
  >#ArriveAliveTour</text>
</svg>
`;

let cachedBuffer: Buffer | null = null;

/** The frame artwork itself, drawn once per server run. */
export async function getStandardOverlayBuffer(): Promise<Buffer> {
  if (!cachedBuffer) {
    cachedBuffer = await sharp(Buffer.from(STANDARD_OVERLAY_SVG)).png().toBuffer();
  }
  return cachedBuffer;
}

/**
 * A URL the phones and tablets can load the standard frame from. Written into
 * the same uploads directory everything else is served out of, under a fixed
 * name so it is written at most once.
 */
export async function getStandardOverlayUrl(): Promise<string> {
  const path = join(UPLOADS_DIR, STANDARD_OVERLAY_FILENAME);
  if (!existsSync(path)) {
    if (!existsSync(UPLOADS_DIR)) {
      await mkdir(UPLOADS_DIR, { recursive: true });
    }
    await writeFile(path, await getStandardOverlayBuffer());
  }
  return publicUrlFor(STANDARD_OVERLAY_FILENAME);
}
