// API Types for Arrive Alive Tour Kiosk System

// Survey type slugs
export type SurveyTypeSlug =
  | 'marijuana'
  | 'alcohol'
  | 'distracted'
  | 'impaired'
  | 'combo';

export const SURVEY_TYPES: { slug: SurveyTypeSlug; label: string }[] = [
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
export interface Overlay {
  id: string;
  name: string;
  imageUrl: string;
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
  /** URL of the composited/overlaid finished photo. */
  finishedPhotoUrl: string | null;
  usedAt: string | null;
  sentAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  syncedAt: string | null;
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
  overlayId: string;
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
