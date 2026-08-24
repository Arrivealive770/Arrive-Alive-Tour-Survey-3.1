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

// Alpha thresholds for telling a frame apart from a sticker-style overlay.
const OPAQUE_ALPHA = 200;
const CLEAR_ALPHA = 40;
// How much of the outer ring must be solid for the artwork to be a border.
// Not 1.0, so rounded corners and soft edges still read as a frame.
const EDGE_OPACITY_THRESHOLD = 0.75;
// How much of the middle must be see-through for there to be a photo window.
const CENTER_CLARITY_THRESHOLD = 0.6;
// Width of the outer ring that gets checked, as a fraction of the image. Kept
// deliberately thin: real frames can have a margin barely 2% wide, and a wider
// ring would sample the transparent window and call the frame an overlay.
const EDGE_BAND = 0.01;
// How far in the "middle" starts, as a fraction of the image.
const CENTER_INSET = 0.2;

/**
 * Decide what an overlay image actually is, by looking at its transparency.
 *
 * A transparent PNG is not automatically a lay-on-top overlay. A polaroid
 * frame exported as a PNG — solid border, see-through hole in the middle — is
 * a frame, and treating it as an overlay stretches it to the photo's shape,
 * which squashes the logos and gives the border uneven thickness.
 *
 * So: solid all the way round the outside AND see-through in the middle means
 * frame. Anything else with an alpha channel is a normal overlay.
 */
export async function detectMode(imageBuffer: Buffer): Promise<"overlay" | "frame"> {
  try {
    const meta = await sharp(imageBuffer).metadata();
    // A JPG can't be see-through, so it can only ever work as a frame.
    if (meta.hasAlpha !== true) return "frame";

    const { data, info } = await sharp(imageBuffer)
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const alphaAt = (x: number, y: number) => data[(y * width + x) * channels + 3] ?? 0;

    const band = Math.max(1, Math.round(width * EDGE_BAND));
    const inset = Math.round(width * CENTER_INSET);

    let edgeTotal = 0;
    let edgeOpaque = 0;
    let centerTotal = 0;
    let centerClear = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const onEdge = x < band || y < band || x >= width - band || y >= height - band;
        if (onEdge) {
          edgeTotal++;
          if (alphaAt(x, y) >= OPAQUE_ALPHA) edgeOpaque++;
          continue;
        }
        const inMiddle = x >= inset && y >= inset && x < width - inset && y < height - inset;
        if (inMiddle) {
          centerTotal++;
          if (alphaAt(x, y) <= CLEAR_ALPHA) centerClear++;
        }
      }
    }

    const edgeRatio = edgeTotal > 0 ? edgeOpaque / edgeTotal : 0;
    const centerRatio = centerTotal > 0 ? centerClear / centerTotal : 0;

    return edgeRatio >= EDGE_OPACITY_THRESHOLD && centerRatio >= CENTER_CLARITY_THRESHOLD
      ? "frame"
      : "overlay";
  } catch (error) {
    // Never let a probe failure block an upload — fall back to the old rule.
    console.error("[OverlayFrame] Mode detection failed, treating as overlay:", error);
    return "overlay";
  }
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

// Longest edge of a finished pledge photo.
//
// A phone camera shot is around 4000px wide. Left at that size, a finished
// photo is a ~30MB PNG that the tablet has to decode in one piece to show the
// preview — Android cannot downsample a PNG while decoding, so it allocates the
// whole ~48MB bitmap and the app is killed for running out of memory. That is
// the tap-the-photo-and-it-dies crash. 1600px is still plenty for the on-screen
// preview and for the emailed keepsake, and keeps the decode well inside a
// tablet's budget.
const MAX_OUTPUT_EDGE = 1600;

// Quality for the JPEG output. High enough that the pledge photo still looks
// like a keepsake, small enough to email without trouble.
const JPEG_QUALITY = 90;

/**
 * Shrink a size so its longest edge fits MAX_OUTPUT_EDGE. Never enlarges.
 *
 * The canvas is capped before anything is composited onto it, not after: sharp
 * resizes before it composites, whatever order the calls are made in, so a
 * late resize would shrink the base and then refuse the now-too-big overlay.
 */
function cappedSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Encode the finished composite.
 *
 * JPEG whenever the result is fully opaque: it decodes far more cheaply on the
 * tablets (Android downsamples JPEGs while decoding, PNGs not at all) and emails
 * at a fraction of the size. PNG only when transparency has to survive.
 */
async function encodeOutput(
  pipeline: sharp.Sharp,
  needsAlpha: boolean
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  if (needsAlpha) {
    // A frame with an alpha channel usually ends up fully opaque anyway — the
    // guest's photo fills the only see-through part of it. Only frames that
    // stay see-through at the edges (rounded corners, cut-out shapes) really
    // need PNG, so the finished image decides rather than the source.
    const png = await pipeline.png().toBuffer();
    const { isOpaque } = await sharp(png).stats();
    if (!isOpaque) {
      return { buffer: png, contentType: "image/png", extension: ".png" };
    }
    return {
      buffer: await sharp(png)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer(),
      contentType: "image/jpeg",
      extension: ".jpg",
    };
  }

  return {
    buffer: await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer(),
    contentType: "image/jpeg",
    extension: ".jpg",
  };
}

/**
 * Composite a photo with an overlay image and return the finished image.
 *
 * frame mode  -> output is the size of the frame, photo cropped to fill the window
 * overlay mode-> output is the size of the photo, overlay stretched on top
 *
 * Either way the result is capped at MAX_OUTPUT_EDGE on its longest side.
 */
export async function compositePhoto(options: {
  photoBuffer: Buffer;
  overlayBuffer: Buffer;
  mode: OverlayMode;
  window: WindowRect | null;
}): Promise<{
  buffer: Buffer;
  mode: "overlay" | "frame";
  window: WindowRect | null;
  contentType: string;
  extension: string;
}> {
  const { photoBuffer, overlayBuffer } = options;

  const overlayMeta = await sharp(overlayBuffer).metadata();
  const hasAlpha = overlayMeta.hasAlpha === true;
  // "auto" looks at the artwork itself. Overlays uploaded before frame
  // detection existed are all stored as "auto", so they get classified here
  // rather than staying stuck on the old has-alpha-means-overlay guess.
  const mode =
    options.mode === "overlay" || options.mode === "frame"
      ? options.mode
      : await detectMode(overlayBuffer);

  if (mode === "overlay") {
    const photoMeta = await sharp(photoBuffer).metadata();
    const { width: photoWidth, height: photoHeight } = cappedSize(
      photoMeta.width || 1080,
      photoMeta.height || 1080
    );

    // Photo down to the capped size first, so it stays the canvas.
    const basePhoto = await sharp(photoBuffer)
      .resize(photoWidth, photoHeight, { fit: "fill" })
      .toBuffer();

    const resizedOverlay = await sharp(overlayBuffer)
      .resize(photoWidth, photoHeight, { fit: "fill" })
      .toBuffer();

    // The photo is the canvas, so the result is opaque and can go out as JPEG.
    const encoded = await encodeOutput(
      sharp(basePhoto).composite([{ input: resizedOverlay, top: 0, left: 0 }]),
      false
    );

    return { ...encoded, mode, window: null };
  }

  // Frame mode. The frame is the canvas, so cap the frame and place the photo
  // using the window rect scaled to the capped frame.
  const { width: frameWidth, height: frameHeight } = cappedSize(
    overlayMeta.width || 1080,
    overlayMeta.height || 1350
  );
  const frameImage = await sharp(overlayBuffer)
    .resize(frameWidth, frameHeight, { fit: "fill" })
    .toBuffer();
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

  // Transparent frame: photo underneath, frame on top so soft edges show, and
  // the transparent parts have to survive, so this one stays a PNG.
  // Opaque frame (JPG): frame is the canvas, photo drops into the window.
  const composed = hasAlpha
    ? sharp({
        create: {
          width: frameWidth,
          height: frameHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      }).composite([
        { input: windowPhoto, top, left },
        { input: frameImage, top: 0, left: 0 },
      ])
    : sharp(frameImage).composite([{ input: windowPhoto, top, left }]);

  const encoded = await encodeOutput(composed, hasAlpha);

  return { ...encoded, mode, window: rect };
}
