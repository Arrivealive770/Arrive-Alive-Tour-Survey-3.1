// API Types for Arrive Alive Tour Kiosk System

// Survey type slugs.
//
// Admins can build their own surveys, so a slug is any string. The union below
// is only the set that ships with the app (used for built-in icons and the
// offline fallback list) — never treat it as the full set of surveys.
export type SurveyTypeSlug = string;

export type BuiltInSurveyTypeSlug =
  | 'marijuana'
  | 'alcohol'
  | 'distracted'
  | 'impaired'
  | 'combo';

export const SURVEY_TYPES: { slug: BuiltInSurveyTypeSlug; label: string }[] = [
  { slug: 'marijuana', label: 'Marijuana' },
  { slug: 'alcohol', label: 'Alcohol' },
  { slug: 'distracted', label: 'Distracted' },
  { slug: 'impaired', label: 'Impaired' },
  { slug: 'combo', label: 'Combo' },
];

// Team
export interface Team {
  id: string;
  name: string;
  code: string;
  phoneCode: string | null;
  codeType?: 'tablet' | 'phone'; // Indicates which code was used to join
  /** Only admin teams may open the Admin section in the app. */
  isAdminTeam?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Device registration
export interface Device {
  id: string;
  teamId: string;
  deviceName: string;
  deviceType: 'tablet' | 'phone';
  isActive: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface RegisterDeviceRequest {
  teamId: string;
  deviceName: string;
  deviceType: 'tablet' | 'phone';
}

// Event
export interface Event {
  id: string;
  teamId: string;
  venueName: string;
  venueCity: string;
  venueState: string;
  eventDate: string;
  surveyTypes: SurveyTypeSlug[];
  overlayType: string; // Now an overlay ID
  overlayId?: string | null; // Assigned custom overlay id
  overlay?: Overlay | null; // Assigned overlay relation (when included)
  picturePledgeEnabled?: boolean;
  status: 'active' | 'completed';
  createdAt: string;
}

export interface CreateEventRequest {
  teamId: string;
  venueName: string;
  venueCity: string;
  venueState: string;
  eventDate: string;
  surveyTypes: SurveyTypeSlug[];
  overlayType: string; // Now an overlay ID
  picturePledgeEnabled?: boolean;
}

// Overlay
/**
 * How an overlay is applied to a pledge photo:
 * - 'frame'   the artwork is a polaroid-style frame and the photo goes inside
 *             its window (this is what a JPG always is — it can't be see-through)
 * - 'overlay' the artwork is laid on top of the photo (needs transparency)
 * - 'auto'    decided by the backend from the image itself
 */
export type OverlayMode = 'auto' | 'overlay' | 'frame';

export interface Overlay {
  id: string;
  name: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  isActive: boolean;
  mode: OverlayMode;
  /** Window rect for frame mode, as fractions (0-1) of the frame image. */
  windowX: number | null;
  windowY: number | null;
  windowW: number | null;
  windowH: number | null;
  createdAt: string;
}

// ==========================================
// Photo status state machine (backend contract)
// ==========================================

export type PhotoStatus =
  | 'available'
  | 'selected'
  | 'processing'
  | 'sent'
  | 'deleted';

/** Full Photo record as returned by the API. Dates are ISO strings. */
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
  selectedByDeviceId: string | null;
  /** Phone device that captured this photo. */
  captureDeviceId: string | null;
  /** True once the capturing phone removed its local original. */
  phoneOriginalDeleted: boolean;
  /** URL of the composited/overlaid finished photo. */
  finishedPhotoUrl: string | null;
  usedAt: string | null;
  sentAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  syncedAt: string | null;
}

/** An entry telling the capturing phone which local original it may delete now. */
export interface PhoneCleanupEntry {
  id: string;
  localId: string;
  storageKey: string | null;
}

/** GET /api/photos/phone-cleanup/:teamId/:eventId response value. */
export interface PhoneCleanupResponse {
  deletable: PhoneCleanupEntry[];
}

/** GET /api/sync/photos/:teamId/:eventId returns a subset of Photo fields. */
export interface AvailablePhoto {
  id: string;
  localId: string;
  storageKey: string | null;
  storageUrl: string | null;
  overlayType: string;
  status: PhotoStatus;
  createdAt: string;
}

/** An entry telling a device which local file to remove. */
export interface DeletedPhotoEntry {
  id: string;
  localId: string;
  storageKey: string | null;
  status: PhotoStatus; // "deleted"
  deletedAt: string | null;
}

export interface DeletedPhotosResponse {
  deleted: DeletedPhotoEntry[];
}

// Photo composite endpoint (POST /api/photos/composite)
export interface CompositePhotoRequest {
  /** URL of the original photo to composite the overlay onto. */
  photoUrl: string;
  /** Overlay id (optional if eventId supplied). */
  overlayId?: string;
  /** Event id — resolves the event's assigned overlay if overlayId omitted. */
  eventId?: string;
}

export interface CompositePhotoResponse {
  compositedUrl: string;
  fileId: string;
  originalPhotoUrl: string;
  /** null when the event had no artwork and the standard frame was used. */
  overlayId: string | null;
  overlayName: string;
}

/** DELETE /api/photos/purge/:eventId response value. */
export interface PurgePhotosResponse {
  purgedCount: number;
}

// US States for dropdown
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];
