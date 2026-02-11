// SQLite Database Schema for Arrive Alive Tour Kiosk System
// This defines the local database structure for offline-first operation

export const DATABASE_NAME = 'arrive_alive_kiosk.db';

export const SCHEMA_VERSION = 1;

// SQL statements to create all tables
export const CREATE_TABLES_SQL = `
-- Device configuration (key-value store)
CREATE TABLE IF NOT EXISTS device_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now'))
);

-- Survey queue (offline storage for completed surveys)
CREATE TABLE IF NOT EXISTS survey_queue (
  localId TEXT PRIMARY KEY,
  teamId TEXT NOT NULL,
  eventId TEXT NOT NULL,
  surveyTypeSlug TEXT NOT NULL,
  responses TEXT NOT NULL,
  ageRange TEXT,
  deviceId TEXT,
  completedAt TEXT NOT NULL,
  durationSeconds INTEGER,
  syncStatus TEXT DEFAULT 'pending',
  syncAttempts INTEGER DEFAULT 0,
  lastSyncError TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- Pledge queue (offline storage for pledges)
CREATE TABLE IF NOT EXISTS pledge_queue (
  localId TEXT PRIMARY KEY,
  surveyLocalId TEXT,
  teamId TEXT NOT NULL,
  eventId TEXT NOT NULL,
  email TEXT,
  photoLocalId TEXT,
  createdAt TEXT NOT NULL,
  syncStatus TEXT DEFAULT 'pending',
  syncAttempts INTEGER DEFAULT 0,
  lastSyncError TEXT
);

-- Photo cache (tablets download photos from cloud for display)
CREATE TABLE IF NOT EXISTS photo_cache (
  localId TEXT PRIMARY KEY,
  teamId TEXT NOT NULL,
  eventId TEXT NOT NULL,
  localPath TEXT NOT NULL,
  overlayType TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  claimedAt TEXT,
  usedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- Photo queue (phone uploads photos to cloud)
CREATE TABLE IF NOT EXISTS photo_queue (
  localId TEXT PRIMARY KEY,
  teamId TEXT NOT NULL,
  eventId TEXT NOT NULL,
  localPath TEXT NOT NULL,
  overlayType TEXT NOT NULL,
  uploadStatus TEXT DEFAULT 'pending',
  uploadAttempts INTEGER DEFAULT 0,
  remoteUrl TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- Current event session (singleton row with id=1)
CREATE TABLE IF NOT EXISTS current_event (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  eventId TEXT,
  teamId TEXT,
  teamCode TEXT,
  venueName TEXT,
  surveyTypes TEXT,
  overlayType TEXT,
  activeSurveyType TEXT,
  startedAt TEXT
);
`;

// TypeScript types corresponding to the database tables

export interface DeviceConfig {
  key: string;
  value: string;
  updatedAt: string;
}

export interface SurveyQueueItem {
  localId: string;
  teamId: string;
  eventId: string;
  surveyTypeSlug: string;
  responses: string; // JSON stringified
  ageRange: string | null;
  deviceId: string | null;
  completedAt: string;
  durationSeconds: number | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
  lastSyncError: string | null;
  createdAt: string;
}

export interface PledgeQueueItem {
  localId: string;
  surveyLocalId: string | null;
  teamId: string;
  eventId: string;
  email: string | null;
  photoLocalId: string | null;
  compositedPhotoUrl: string | null;
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
  lastSyncError: string | null;
}

export interface PhotoCacheItem {
  localId: string;
  teamId: string;
  eventId: string;
  localPath: string;
  overlayType: string;
  status: 'available' | 'claimed' | 'used';
  claimedAt: string | null;
  usedAt: string | null;
  createdAt: string;
}

export interface PhotoQueueItem {
  localId: string;
  teamId: string;
  eventId: string;
  localPath: string;
  overlayType: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  uploadAttempts: number;
  remoteUrl: string | null;
  createdAt: string;
}

export interface CurrentEvent {
  id: 1;
  eventId: string | null;
  teamId: string | null;
  teamCode: string | null;
  venueName: string | null;
  surveyTypes: string | null; // JSON stringified array
  overlayType: string | null;
  activeSurveyType: string | null;
  startedAt: string | null;
}

// Sync status constants
export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
} as const;

export const UPLOAD_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  FAILED: 'failed',
} as const;

export const PHOTO_STATUS = {
  AVAILABLE: 'available',
  CLAIMED: 'claimed',
  USED: 'used',
} as const;
