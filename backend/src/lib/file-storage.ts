import { mkdir, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import { env } from "../env";

/**
 * File storage on the server's own disk.
 *
 * Overlays, event artwork and finished pledge photos used to be pushed to
 * storage.vibecodeapp.com. That only ever worked from inside Vibecode: the
 * storage service identifies the project from the calling sandbox, so the same
 * request from the desktop server has no project to land in and is rejected.
 * The visible symptom was an overlay upload that failed with no useful reason.
 *
 * Everything is written to ./uploads instead, which src/index.ts already serves
 * at /uploads/*, and which the nightly backup already covers. The tour's server
 * now owns its own files and needs nothing from Vibecode to run.
 */

const UPLOADS_DIR = join(process.cwd(), "uploads");

const ensureUploadsDir = async () => {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
};

/** Mirrors the response shape the remote storage service used to return. */
export interface StoredFile {
  id: string;
  url: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

/**
 * Absolute URL for a stored file.
 *
 * Absolute rather than "/uploads/x.png" because the tablets render these
 * straight into an <Image>, the compositing routes fetch() them back, and the
 * pledge email embeds them — none of which can resolve a server-relative path.
 * BACKEND_URL is whatever the desktop is reachable as (the Tailscale address in
 * the field), so the address only lives in one place.
 */
export function publicUrlFor(filename: string): string {
  return `${env.BACKEND_URL.replace(/\/$/, "")}/uploads/${filename}`;
}

/**
 * Write bytes to the uploads directory and return where they can be reached.
 *
 * `preferredName` is only used for its extension and to remember what the
 * operator called the file; the stored name is always a fresh UUID so two
 * uploads of "frame.png" cannot overwrite each other.
 */
export async function storeFile(options: {
  buffer: Buffer;
  preferredName?: string;
  contentType?: string;
}): Promise<StoredFile> {
  await ensureUploadsDir();

  const originalFilename = options.preferredName?.trim() || "upload";
  const contentType = options.contentType?.trim() || "application/octet-stream";
  const extension =
    extname(originalFilename).toLowerCase() ||
    EXTENSION_BY_TYPE[contentType.toLowerCase()] ||
    "";

  const id = randomUUID();
  const filename = `${id}${extension}`;

  await writeFile(join(UPLOADS_DIR, filename), options.buffer);

  return {
    id: filename,
    url: publicUrlFor(filename),
    originalFilename,
    contentType,
    sizeBytes: options.buffer.length,
  };
}

/**
 * Delete a stored file. Best-effort: a missing file is the desired end state,
 * so this never throws and never blocks a purge or a delete.
 */
export async function deleteStoredFile(idOrUrl: string): Promise<void> {
  try {
    const filename = storedFilenameFor(idOrUrl);
    if (!filename) return;
    await unlink(join(UPLOADS_DIR, filename));
  } catch {
    // Already gone, or never ours to begin with.
  }
}

/**
 * Pull the on-disk filename out of either a bare id or a /uploads/ URL.
 * Returns null for anything that isn't ours — remote URLs from before the
 * move to local storage still exist in the database and must be left alone.
 */
export function storedFilenameFor(idOrUrl: string): string | null {
  if (!idOrUrl) return null;

  if (idOrUrl.includes("/uploads/")) {
    const tail = idOrUrl.split("/uploads/").pop() ?? "";
    const filename = tail.split(/[?#]/)[0] ?? "";
    return filename && !filename.includes("/") ? filename : null;
  }

  // A bare id, as stored in Overlay.fileId. Reject anything path-like so a
  // crafted value cannot climb out of the uploads directory.
  if (idOrUrl.includes("/") || idOrUrl.includes("\\") || idOrUrl.includes("..")) {
    return null;
  }
  return idOrUrl;
}
