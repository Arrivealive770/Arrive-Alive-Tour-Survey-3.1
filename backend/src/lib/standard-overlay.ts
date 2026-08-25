import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { publicUrlFor } from "./file-storage";
import type { WindowRect } from "./overlay-frame";

/**
 * The stock pledge frame — the official Arrive Alive Tour artwork.
 *
 * Every event gets this frame unless custom artwork is picked for it when the
 * event is created. Events get created in a hurry at the venue and custom
 * artwork often shows up later (or never), so without a stock frame the phone
 * had nothing to line the shot up against and the finished photo came back
 * unbranded — or, worse, the composite failed outright.
 *
 * It used to be drawn here as an SVG stand-in. It is now the real artwork,
 * shipped as a PNG at src/public/standard-overlay.png: a white border with a
 * see-through window and the tour wordmark beneath it. Bump the version in
 * STANDARD_OVERLAY_FILENAME whenever the artwork is replaced, otherwise servers
 * that already copied the old file into uploads/ would keep serving it.
 */

const SOURCE_PATH = join(process.cwd(), "src", "public", "standard-overlay.png");

// The name the copy in uploads/ is served under. Version it: see above.
const STANDARD_OVERLAY_FILENAME = "standard-overlay-v2.png";
const UPLOADS_DIR = join(process.cwd(), "uploads");

export const STANDARD_OVERLAY_NAME = "Arrive Alive Tour (stock)";
export const STANDARD_OVERLAY_SIZE = { width: 1080, height: 1080 };

/**
 * Where the guest's photo lands inside the frame, as fractions of the frame.
 * These are the bounds of the transparent window in the artwork above; keep
 * them in step if the PNG is ever replaced.
 */
export const STANDARD_OVERLAY_WINDOW: WindowRect = {
  x: 21 / 1080,
  y: 21 / 1080,
  w: 1040 / 1080,
  h: 892 / 1080,
};

let cachedBuffer: Buffer | null = null;

/** The frame artwork itself, read off disk once per server run. */
export async function getStandardOverlayBuffer(): Promise<Buffer> {
  if (!cachedBuffer) {
    cachedBuffer = await readFile(SOURCE_PATH);
  }
  return cachedBuffer;
}

/**
 * A URL the phones and tablets can load the stock frame from. Copied into the
 * same uploads directory everything else is served out of, under a fixed name
 * so it is written at most once.
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
