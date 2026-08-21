// Overlay compositing helpers.
//
// Two ways an overlay can be applied to a pledge photo:
//
//   "overlay" — a transparent PNG stretched on top of the photo (the original
//               behaviour). Only makes sense when the image has an alpha
//               channel, otherwise it just hides the photo completely.
//
//   "frame"   — a polaroid: the uploaded image IS the frame, and the photo is
//               dropped into a window inside it. This is what makes plain JPG
//               overlays usable, since a JPG can never be transparent.
//
// The window rect is stored per-overlay as fractions of the frame. It is
// detected automatically on upload (and lazily for overlays uploaded before
// frame support existed) by looking for the big block in the middle that
// differs from the frame's border colour.

import sharp from "sharp";

export type OverlayMode = "auto" | "overlay" | "frame";

export interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Classic polaroid proportions: even margins on three sides, fat bottom border.
// Used whenever auto-detection can't find a convincing window.
export const DEFAULT_WINDOW: WindowRect = {
  x: 0.07,
  y: 0.06,
  w: 0.86,
  h: 0.72,
};

// Analysis resolution for window detection — small enough to be fast, big
// enough that a window edge lands within half a percent of the real one.
const SAMPLE_SIZE = 240;
// How different from the border colour a pixel must be to count as "window".
const COLOR_DISTANCE_THRESHOLD = 44;
// Fraction of a row/column that must be window pixels for the whole line to
// count. Keeps logos and text in the border from inflating the window.
const LINE_DENSITY_THRESHOLD = 0.55;

export function resolveMode(mode: string | null | undefined, hasAlpha: boolean): "overlay" | "frame" {
  if (mode === "overlay" || mode === "frame") return mode;
  return hasAlpha ? "overlay" : "frame";
}

export function windowFromOverlay(overlay: {
  windowX: number | null;
  windowY: number | null;
  windowW: number | null;
  windowH: number | null;
}): WindowRect | null {
  const { windowX, windowY, windowW, windowH } = overlay;
  if (windowX == null || windowY == null || windowW == null || windowH == null) {
    return null;
  }
  return { x: windowX, y: windowY, w: windowW, h: windowH };
}

function isSane(rect: WindowRect): boolean {
  const area = rect.w * rect.h;
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.w > 0.25 &&
    rect.h > 0.25 &&
    rect.x + rect.w <= 1.0001 &&
    rect.y + rect.h <= 1.0001 &&
    area > 0.1 &&
    area < 0.94
  );
}

/**
 * Find the photo window inside a frame image.
 *
 * Samples the four corners to learn the frame colour, marks every pixel that
 * differs from it, then takes the bounding box of the rows and columns that
 * are mostly made of those pixels. Falls back to polaroid proportions when the
 * result doesn't look like a window (no hole, or the whole image is the hole).
 */
export async function detectFrameWindow(imageBuffer: Buffer): Promise<WindowRect> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const at = (x: number, y: number): [number, number, number] => {
      const i = (y * width + x) * channels;
      return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
    };

    // Frame colour = average of the four corner patches.
    const patch = Math.max(2, Math.floor(SAMPLE_SIZE * 0.02));
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    const corners: [number, number][] = [
      [0, 0],
      [width - patch, 0],
      [0, height - patch],
      [width - patch, height - patch],
    ];
    for (const [cx, cy] of corners) {
      for (let y = cy; y < cy + patch; y++) {
        for (let x = cx; x < cx + patch; x++) {
          const [r, g, b] = at(x, y);
          sr += r;
          sg += g;
          sb += b;
          n++;
        }
      }
    }
    const frame: [number, number, number] = [sr / n, sg / n, sb / n];

    const isWindowPixel = (x: number, y: number) => {
      const [r, g, b] = at(x, y);
      const dist = Math.max(
        Math.abs(r - frame[0]),
        Math.abs(g - frame[1]),
        Math.abs(b - frame[2])
      );
      return dist > COLOR_DISTANCE_THRESHOLD;
    };

    // Rows/columns that are mostly window pixels.
    const rowHit: boolean[] = [];
    for (let y = 0; y < height; y++) {
      let count = 0;
      for (let x = 0; x < width; x++) if (isWindowPixel(x, y)) count++;
      rowHit[y] = count / width >= LINE_DENSITY_THRESHOLD;
    }
    const colHit: boolean[] = [];
    for (let x = 0; x < width; x++) {
      let count = 0;
      for (let y = 0; y < height; y++) if (isWindowPixel(x, y)) count++;
      colHit[x] = count / height >= LINE_DENSITY_THRESHOLD;
    }

    const first = (hits: boolean[]) => hits.findIndex(Boolean);
    const last = (hits: boolean[]) => hits.length - 1 - [...hits].reverse().findIndex(Boolean);

    const top = first(rowHit);
    const left = first(colHit);
    if (top === -1 || left === -1) {
      return DEFAULT_WINDOW;
    }
    const bottom = last(rowHit);
    const right = last(colHit);

    const rect: WindowRect = {
      x: left / width,
      y: top / height,
      w: (right - left + 1) / width,
      h: (bottom - top + 1) / height,
    };

    return isSane(rect) ? rect : DEFAULT_WINDOW;
  } catch (error) {
    console.error("[OverlayFrame] Window detection failed, using default:", error);
    return DEFAULT_WINDOW;
  }
}

/**
 * Composite a photo with an overlay image and return a PNG buffer.
 *
 * frame mode  -> output is the size of the frame, photo cropped to fill the window
 * overlay mode-> output is the size of the photo, overlay stretched on top
 */
export async function compositePhoto(options: {
  photoBuffer: Buffer;
  overlayBuffer: Buffer;
  mode: OverlayMode;
  window: WindowRect | null;
}): Promise<{ buffer: Buffer; mode: "overlay" | "frame"; window: WindowRect | null }> {
  const { photoBuffer, overlayBuffer } = options;

  const overlayMeta = await sharp(overlayBuffer).metadata();
  const hasAlpha = overlayMeta.hasAlpha === true;
  const mode = resolveMode(options.mode, hasAlpha);

  if (mode === "overlay") {
    const photoMeta = await sharp(photoBuffer).metadata();
    const photoWidth = photoMeta.width || 1080;
    const photoHeight = photoMeta.height || 1080;

    const resizedOverlay = await sharp(overlayBuffer)
      .resize(photoWidth, photoHeight, { fit: "fill" })
      .toBuffer();

    const buffer = await sharp(photoBuffer)
      .composite([{ input: resizedOverlay, top: 0, left: 0 }])
      .png()
      .toBuffer();

    return { buffer, mode, window: null };
  }

  // Frame mode.
  const frameWidth = overlayMeta.width || 1080;
  const frameHeight = overlayMeta.height || 1350;
  const rect = options.window ?? (await detectFrameWindow(overlayBuffer));

  // Clamp to the frame so a bad hand-entered rect can't blow up sharp.
  const left = Math.round(Math.min(Math.max(rect.x, 0), 0.99) * frameWidth);
  const top = Math.round(Math.min(Math.max(rect.y, 0), 0.99) * frameHeight);
  const width = Math.max(1, Math.min(Math.round(rect.w * frameWidth), frameWidth - left));
  const height = Math.max(1, Math.min(Math.round(rect.h * frameHeight), frameHeight - top));

  // Crop-to-fill so the photo never stretches, whichever way it was shot.
  const windowPhoto = await sharp(photoBuffer)
    .resize(width, height, { fit: "cover", position: "centre" })
    .toBuffer();

  let buffer: Buffer;
  if (hasAlpha) {
    // Transparent frame: photo underneath, frame on top so soft edges show.
    buffer = await sharp({
      create: {
        width: frameWidth,
        height: frameHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: windowPhoto, top, left },
        { input: overlayBuffer, top: 0, left: 0 },
      ])
      .png()
      .toBuffer();
  } else {
    // Opaque frame (JPG): frame is the canvas, photo drops into the window.
    buffer = await sharp(overlayBuffer)
      .composite([{ input: windowPhoto, top, left }])
      .png()
      .toBuffer();
  }

  return { buffer, mode, window: rect };
}
