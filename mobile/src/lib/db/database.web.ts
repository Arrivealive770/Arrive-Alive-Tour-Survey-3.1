// Web-compatible database implementation using localStorage
// This is used automatically for web builds where expo-sqlite is not available

import {
  DATABASE_NAME,
  type DeviceConfig,
  type SurveyQueueItem,
  type PledgeQueueItem,
  type PhotoCacheItem,
  type PhotoQueueItem,
  type CurrentEvent,
  SYNC_STATUS,
  UPLOAD_STATUS,
  PHOTO_STATUS,
} from './schema';

const STORAGE_KEY = `${DATABASE_NAME}_data`;

interface DatabaseData {
  device_config: Record<string, DeviceConfig>;
  survey_queue: Record<string, SurveyQueueItem>;
  pledge_queue: Record<string, PledgeQueueItem>;
  photo_cache: Record<string, PhotoCacheItem>;
  photo_queue: Record<string, PhotoQueueItem>;
  current_event: CurrentEvent | null;
}

function getEmptyData(): DatabaseData {
  return {
    device_config: {},
    survey_queue: {},
    pledge_queue: {},
    photo_cache: {},
    photo_queue: {},
    current_event: null,
  };
}

function loadData(): DatabaseData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('[WebDB] Failed to load data:', e);
  }
  return getEmptyData();
}

function saveData(data: DatabaseData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[WebDB] Failed to save data:', e);
  }
}

function now(): string {
  return new Date().toISOString();
}

export class DatabaseService {
  private data: DatabaseData = getEmptyData();
  private initialized = false;

  async initialize(): Promise<void> {
    this.data = loadData();
    this.initialized = true;
    console.log('[WebDB] Database initialized (localStorage)');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
  }

  // ==================== Device Config ====================

  async getConfig(key: string): Promise<string | null> {
    this.ensureInitialized();
    return this.data.device_config[key]?.value ?? null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    this.ensureInitialized();
    this.data.device_config[key] = { key, value, updatedAt: now() };
    saveData(this.data);
  }

  async getAllConfig(): Promise<Record<string, string>> {
    this.ensureInitialized();
    const config: Record<string, string> = {};
    for (const [key, item] of Object.entries(this.data.device_config)) {
      config[key] = item.value;
    }
    return config;
  }

  async deleteConfig(key: string): Promise<void> {
    this.ensureInitialized();
    delete this.data.device_config[key];
    saveData(this.data);
  }

  // ==================== Survey Queue ====================

  async queueSurvey(survey: Omit<SurveyQueueItem, 'syncStatus' | 'syncAttempts' | 'lastSyncError' | 'createdAt'>): Promise<void> {
    this.ensureInitialized();
    this.data.survey_queue[survey.localId] = {
      ...survey,
      syncStatus: SYNC_STATUS.PENDING as 'pending',
      syncAttempts: 0,
      lastSyncError: null,
      createdAt: now(),
    };
    saveData(this.data);
  }

  async getPendingSurveys(limit: number = 50): Promise<SurveyQueueItem[]> {
    this.ensureInitialized();
    return Object.values(this.data.survey_queue)
      .filter(s => s.syncStatus === SYNC_STATUS.PENDING || s.syncStatus === SYNC_STATUS.FAILED)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  async getSurveyById(localId: string): Promise<SurveyQueueItem | null> {
    this.ensureInitialized();
    return this.data.survey_queue[localId] ?? null;
  }

  async markSurveysSyncing(localIds: string[]): Promise<void> {
    this.ensureInitialized();
    for (const id of localIds) {
      if (this.data.survey_queue[id]) {
        this.data.survey_queue[id].syncStatus = SYNC_STATUS.SYNCING as 'syncing';
        this.data.survey_queue[id].syncAttempts++;
      }
    }
    saveData(this.data);
  }

  async markSurveysSynced(localIds: string[]): Promise<void> {
    this.ensureInitialized();
    for (const id of localIds) {
      if (this.data.survey_queue[id]) {
        this.data.survey_queue[id].syncStatus = SYNC_STATUS.SYNCED as 'synced';
      }
    }
    saveData(this.data);
  }

  async markSurveyFailed(localId: string, error: string): Promise<void> {
    this.ensureInitialized();
    if (this.data.survey_queue[localId]) {
      this.data.survey_queue[localId].syncStatus = SYNC_STATUS.FAILED as 'failed';
      this.data.survey_queue[localId].lastSyncError = error;
    }
    saveData(this.data);
  }

  async getSurveyQueueCount(): Promise<{ pending: number; synced: number; failed: number }> {
    this.ensureInitialized();
    const counts = { pending: 0, synced: 0, failed: 0 };
    for (const survey of Object.values(this.data.survey_queue)) {
      if (survey.syncStatus === SYNC_STATUS.PENDING || survey.syncStatus === SYNC_STATUS.SYNCING) {
        counts.pending++;
      } else if (survey.syncStatus === SYNC_STATUS.SYNCED) {
        counts.synced++;
      } else if (survey.syncStatus === SYNC_STATUS.FAILED) {
        counts.failed++;
      }
    }
    return counts;
  }

  async deleteSyncedSurveys(olderThanDays: number = 7): Promise<number> {
    this.ensureInitialized();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    let deleted = 0;
    for (const [id, survey] of Object.entries(this.data.survey_queue)) {
      if (survey.syncStatus === SYNC_STATUS.SYNCED && new Date(survey.createdAt) < cutoff) {
        delete this.data.survey_queue[id];
        deleted++;
      }
    }
    saveData(this.data);
    return deleted;
  }

  // ==================== Pledge Queue ====================

  async queuePledge(pledge: Omit<PledgeQueueItem, 'syncStatus' | 'syncAttempts' | 'lastSyncError'>): Promise<void> {
    this.ensureInitialized();
    this.data.pledge_queue[pledge.localId] = {
      ...pledge,
      syncStatus: SYNC_STATUS.PENDING as 'pending',
      syncAttempts: 0,
      lastSyncError: null,
    };
    saveData(this.data);
  }

  async getPendingPledges(limit: number = 50): Promise<PledgeQueueItem[]> {
    this.ensureInitialized();
    return Object.values(this.data.pledge_queue)
      .filter(p => p.syncStatus === SYNC_STATUS.PENDING || p.syncStatus === SYNC_STATUS.FAILED)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  async markPledgesSynced(localIds: string[]): Promise<void> {
    this.ensureInitialized();
    for (const id of localIds) {
      if (this.data.pledge_queue[id]) {
        this.data.pledge_queue[id].syncStatus = SYNC_STATUS.SYNCED as 'synced';
      }
    }
    saveData(this.data);
  }

  async markPledgeFailed(localId: string, error: string): Promise<void> {
    this.ensureInitialized();
    if (this.data.pledge_queue[localId]) {
      this.data.pledge_queue[localId].syncStatus = SYNC_STATUS.FAILED as 'failed';
      this.data.pledge_queue[localId].lastSyncError = error;
      this.data.pledge_queue[localId].syncAttempts++;
    }
    saveData(this.data);
  }

  async getPledgeQueueCount(): Promise<number> {
    this.ensureInitialized();
    return Object.values(this.data.pledge_queue)
      .filter(p => p.syncStatus === SYNC_STATUS.PENDING || p.syncStatus === SYNC_STATUS.FAILED)
      .length;
  }

  // ==================== Photo Cache (Tablet) ====================

  async addToPhotoCache(photo: Omit<PhotoCacheItem, 'status' | 'claimedAt' | 'usedAt' | 'createdAt'>): Promise<void> {
    this.ensureInitialized();
    this.data.photo_cache[photo.localId] = {
      ...photo,
      status: PHOTO_STATUS.AVAILABLE as 'available',
      claimedAt: null,
      usedAt: null,
      createdAt: now(),
    };
    saveData(this.data);
  }

  async getAvailablePhotos(teamId: string, eventId: string, limit: number = 10): Promise<PhotoCacheItem[]> {
    this.ensureInitialized();
    return Object.values(this.data.photo_cache)
      .filter(p => p.teamId === teamId && p.eventId === eventId && p.status === PHOTO_STATUS.AVAILABLE)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async claimPhoto(localId: string): Promise<void> {
    this.ensureInitialized();
    if (this.data.photo_cache[localId]) {
      this.data.photo_cache[localId].status = PHOTO_STATUS.CLAIMED as 'claimed';
      this.data.photo_cache[localId].claimedAt = now();
    }
    saveData(this.data);
  }

  async markPhotoUsed(localId: string): Promise<void> {
    this.ensureInitialized();
    if (this.data.photo_cache[localId]) {
      this.data.photo_cache[localId].status = PHOTO_STATUS.USED as 'used';
      this.data.photo_cache[localId].usedAt = now();
    }
    saveData(this.data);
  }

  async releasePhoto(localId: string): Promise<void> {
    this.ensureInitialized();
    const photo = this.data.photo_cache[localId];
    if (photo && photo.status === PHOTO_STATUS.CLAIMED) {
      photo.status = PHOTO_STATUS.AVAILABLE as 'available';
      photo.claimedAt = null;
    }
    saveData(this.data);
  }

  async getPhotoCacheCount(teamId: string, eventId: string): Promise<{ available: number; claimed: number; used: number }> {
    this.ensureInitialized();
    const counts = { available: 0, claimed: 0, used: 0 };
    for (const photo of Object.values(this.data.photo_cache)) {
      if (photo.teamId === teamId && photo.eventId === eventId) {
        if (photo.status === PHOTO_STATUS.AVAILABLE) counts.available++;
        else if (photo.status === PHOTO_STATUS.CLAIMED) counts.claimed++;
        else if (photo.status === PHOTO_STATUS.USED) counts.used++;
      }
    }
    return counts;
  }

  async clearPhotoCache(teamId: string, eventId: string): Promise<void> {
    this.ensureInitialized();
    for (const [id, photo] of Object.entries(this.data.photo_cache)) {
      if (photo.teamId === teamId && photo.eventId === eventId) {
        delete this.data.photo_cache[id];
      }
    }
    saveData(this.data);
  }

  // ==================== Photo Queue (Phone) ====================

  async queuePhoto(photo: Omit<PhotoQueueItem, 'uploadStatus' | 'uploadAttempts' | 'remoteUrl' | 'createdAt'>): Promise<void> {
    this.ensureInitialized();
    this.data.photo_queue[photo.localId] = {
      ...photo,
      uploadStatus: UPLOAD_STATUS.PENDING as 'pending',
      uploadAttempts: 0,
      remoteUrl: null,
      createdAt: now(),
    };
    saveData(this.data);
  }

  async getPendingPhotos(limit: number = 10): Promise<PhotoQueueItem[]> {
    this.ensureInitialized();
    return Object.values(this.data.photo_queue)
      .filter(p => p.uploadStatus === UPLOAD_STATUS.PENDING || p.uploadStatus === UPLOAD_STATUS.FAILED)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  async markPhotoUploading(localId: string): Promise<void> {
    this.ensureInitialized();
    if (this.data.photo_queue[localId]) {
      this.data.photo_queue[localId].uploadStatus = UPLOAD_STATUS.UPLOADING as 'uploading';
      this.data.photo_queue[localId].uploadAttempts++;
    }
    saveData(this.data);
  }

  async markPhotoUploaded(localId: string, remoteUrl: string): Promise<void> {
    this.ensureInitialized();
    if (this.data.photo_queue[localId]) {
      this.data.photo_queue[localId].uploadStatus = UPLOAD_STATUS.UPLOADED as 'uploaded';
      this.data.photo_queue[localId].remoteUrl = remoteUrl;
    }
    saveData(this.data);
  }

  async markPhotoUploadFailed(localId: string): Promise<void> {
    this.ensureInitialized();
    if (this.data.photo_queue[localId]) {
      this.data.photo_queue[localId].uploadStatus = UPLOAD_STATUS.FAILED as 'failed';
    }
    saveData(this.data);
  }

  async getPhotoQueueCount(): Promise<number> {
    this.ensureInitialized();
    return Object.values(this.data.photo_queue)
      .filter(p => p.uploadStatus === UPLOAD_STATUS.PENDING || p.uploadStatus === UPLOAD_STATUS.FAILED)
      .length;
  }

  async deleteUploadedPhotos(olderThanDays: number = 7): Promise<number> {
    this.ensureInitialized();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    let deleted = 0;
    for (const [id, photo] of Object.entries(this.data.photo_queue)) {
      if (photo.uploadStatus === UPLOAD_STATUS.UPLOADED && new Date(photo.createdAt) < cutoff) {
        delete this.data.photo_queue[id];
        deleted++;
      }
    }
    saveData(this.data);
    return deleted;
  }

  // ==================== Current Event ====================

  async getCurrentEvent(): Promise<CurrentEvent | null> {
    this.ensureInitialized();
    return this.data.current_event;
  }

  async setCurrentEvent(event: Omit<CurrentEvent, 'id'>): Promise<void> {
    this.ensureInitialized();
    this.data.current_event = { id: 1, ...event };
    saveData(this.data);
  }

  async updateActiveSurveyType(surveyType: string): Promise<void> {
    this.ensureInitialized();
    if (this.data.current_event) {
      this.data.current_event.activeSurveyType = surveyType;
    }
    saveData(this.data);
  }

  async clearCurrentEvent(): Promise<void> {
    this.ensureInitialized();
    this.data.current_event = null;
    saveData(this.data);
  }

  // ==================== Cleanup & Maintenance ====================

  async resetDatabase(): Promise<void> {
    this.data = getEmptyData();
    saveData(this.data);
    console.log('[WebDB] Database reset complete');
  }

  async close(): Promise<void> {
    this.initialized = false;
    console.log('[WebDB] Database connection closed');
  }
}

// Singleton instance for the app
let databaseInstance: DatabaseService | null = null;
let isInitialized = false;

export function getDatabase(): DatabaseService {
  if (!databaseInstance) {
    databaseInstance = new DatabaseService();
  }
  return databaseInstance;
}

export function isDatabaseInitialized(): boolean {
  return isInitialized;
}

export async function initializeDatabase(): Promise<DatabaseService> {
  const db = getDatabase();
  await db.initialize();
  isInitialized = true;
  return db;
}

/**
 * Safe database access - returns null if not initialized
 * Use this for operations that can gracefully skip if DB isn't ready
 */
export function getDatabaseSafe(): DatabaseService | null {
  if (!isInitialized || !databaseInstance) {
    return null;
  }
  return databaseInstance;
}
