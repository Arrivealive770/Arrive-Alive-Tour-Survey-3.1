/**
 * Shared API contract types for the Arrive Alive Tour "Photo and Pledge" workflow.
 *
 * These types are the single source of truth for the request/response shapes
 * exchanged between the backend and the mobile client. Keep them in sync with
 * prisma/schema.prisma and the route handlers.
 *
 * Response envelope convention (see .claude/rules/api-patterns.md):
 *   Success: { data: <value> }
 *   Error:   { error: { message: string, code: string } }
 * The mobile client auto-unwraps `data`, so type helpers against the INNER value.
 */

// ==========================================
// Photo status state machine
// ==========================================

/**
 * The five (and only five) valid Photo statuses.
 *  - available:  uploaded/synced from phone, selectable by participants
 *  - selected:   a participant has picked it (locked so no one else can)
 *  - processing: overlay is being applied / finished photo is being sent
 *  - sent:       finished (overlaid) photo successfully delivered
 *  - deleted:    cleaned up; should be removed from phone + both tablets
 */
export type PhotoStatus =
  | "available"
  | "selected"
  | "processing"
  | "sent"
  | "deleted";

export const PHOTO_STATUSES: readonly PhotoStatus[] = [
  "available",
  "selected",
  "processing",
  "sent",
  "deleted",
] as const;

/** Full Photo record as returned by the API. */
export interface Photo {
  id: string;
  localId: string;
  teamId: string;
  eventId: string;
  storageKey: string | null;
  /** URL of the ORIGINAL (raw, no-overlay) photo. */
  storageUrl: string | null;
  overlayType: string;
  status: PhotoStatus;
  /** Device (tablet) that selected/locked this photo. */
  selectedByDeviceId: string | null;
  /** URL of the composited/overlaid finished photo. */
  finishedPhotoUrl: string | null;
  usedAt: string | null;
  sentAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  syncedAt: string | null;
}

// ==========================================
// Photo transition endpoint request bodies
// ==========================================

/** PUT /api/photos/:id/select */
export interface SelectPhotoRequest {
  deviceId: string;
}

/** PUT /api/photos/:id/process */
export interface ProcessPhotoRequest {
  finishedPhotoUrl?: string;
}

/** PUT /api/photos/:id/sent */
export interface SentPhotoRequest {
  finishedPhotoUrl: string;
}

// PUT /api/photos/:id/release and PUT /api/photos/:id/delete take no body.

// ==========================================
// Deletion propagation
// ==========================================

/** An entry telling a device which local file to remove. */
export interface DeletedPhotoEntry {
  id: string;
  localId: string;
  storageKey: string | null;
  status: PhotoStatus; // "deleted"
  deletedAt: string | null;
}

/** GET /api/photos/deleted/:teamId/:eventId response value. */
export interface DeletedPhotosResponse {
  deleted: DeletedPhotoEntry[];
}

// ==========================================
// Compositing
// ==========================================

/** POST /api/photos/composite request. */
export interface CompositePhotoRequest {
  /** URL of the original photo to composite the overlay onto. */
  photoUrl: string;
  /** Overlay id to composite. Optional if eventId is supplied. */
  overlayId?: string;
  /** Event id — resolves the event's assigned overlay if overlayId is omitted. */
  eventId?: string;
}

/** POST /api/photos/composite response value. */
export interface CompositePhotoResponse {
  compositedUrl: string;
  fileId: string;
  originalPhotoUrl: string;
  overlayId: string;
  overlayName: string;
}

// ==========================================
// Purge
// ==========================================

/** DELETE /api/photos/purge/:eventId response value. */
export interface PurgePhotosResponse {
  purgedCount: number;
}

// ==========================================
// Event overlay assignment
// ==========================================

/** PUT /api/events/:id accepts overlayId (among other event fields). */
export interface AssignEventOverlayRequest {
  overlayId: string | null;
}
