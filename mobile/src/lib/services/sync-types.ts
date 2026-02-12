// Sync service types for the Arrive Alive Tour app

import type { SurveyQueueItem, PledgeQueueItem, PhotoQueueItem } from '@/lib/db/schema';

/**
 * Result of a sync operation
 */
export interface SyncResult {
  status: 'success' | 'partial' | 'error' | 'skipped';
  surveys?: { synced: number; failed: number };
  pledges?: { synced: number; failed: number };
  photos?: { synced: number; failed: number };
  error?: string;
}

/**
 * Payload sent to the sync endpoint
 */
export interface SyncPayload {
  surveys?: SurveyQueueItem[];
  pledges?: PledgeQueueItem[];
  photos?: PhotoQueueItem[];
  deviceId: string;
  teamId: string;
}

/**
 * Survey batch sync request
 */
export interface SurveyBatchPayload {
  surveys: Array<{
    localId: string;
    teamId: string;
    eventId: string;
    surveyTypeSlug: string;
    responses: string;
    ageRange: string | null;
    deviceId: string | null;
    completedAt: string;
    durationSeconds: number | null;
  }>;
  deviceId: string;
  teamId: string;
}

/**
 * Pledge batch sync request
 */
export interface PledgeBatchPayload {
  pledges: Array<{
    localId: string;
    surveyLocalId: string | null;
    teamId: string;
    eventId: string;
    email: string | null;
    photoLocalId: string | null;
    createdAt: string;
  }>;
  deviceId: string;
  teamId: string;
}

/**
 * Photo upload response from the server
 */
export interface PhotoUploadResponse {
  localId: string;
  remoteUrl: string;
  success: boolean;
}

/**
 * Remote photo metadata from the server
 */
export interface RemotePhotoMetadata {
  localId: string;
  remoteUrl: string;
  overlayType: string;
  createdAt: string;
}

/**
 * Response from the photos list endpoint
 */
export interface PhotoListResponse {
  photos: RemotePhotoMetadata[];
  count: number;
}

/**
 * Sync batch response from the server
 */
export interface SyncBatchResponse {
  synced: string[]; // Array of localIds that were successfully synced
  skipped: string[]; // Array of localIds that were already synced
  errors: Array<{
    localId: string;
    error: string;
  }>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  multiplier: number;
}

/**
 * Default retry configuration
 * - Attempt 1 failure: Wait 5 seconds
 * - Attempt 2 failure: Wait 15 seconds
 * - Attempt 3 failure: Wait 45 seconds
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 5000,
  multiplier: 3,
};

/**
 * Sync item type for retry scheduling
 */
export type SyncItemType = 'surveys' | 'pledges' | 'photos';
