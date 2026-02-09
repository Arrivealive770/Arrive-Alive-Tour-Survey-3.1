import * as SQLite from 'expo-sqlite';
import {
  DATABASE_NAME,
  CREATE_TABLES_SQL,
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

export class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(DATABASE_NAME);

      // Execute all CREATE TABLE statements
      const statements = CREATE_TABLES_SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        await this.db.execAsync(statement + ';');
      }

      console.log('[DatabaseService] Database initialized successfully');
    } catch (error) {
      console.error('[DatabaseService] Failed to initialize database:', error);
      throw error;
    }
  }

  private getDb(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  // ==================== Device Config ====================

  async getConfig(key: string): Promise<string | null> {
    const db = this.getDb();
    const result = await db.getFirstAsync<DeviceConfig>(
      'SELECT * FROM device_config WHERE key = ?',
      [key]
    );
    return result?.value ?? null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO device_config (key, value, updatedAt)
       VALUES (?, ?, datetime('now'))`,
      [key, value]
    );
  }

  async getAllConfig(): Promise<Record<string, string>> {
    const db = this.getDb();
    const rows = await db.getAllAsync<DeviceConfig>('SELECT * FROM device_config');
    const config: Record<string, string> = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return config;
  }

  async deleteConfig(key: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync('DELETE FROM device_config WHERE key = ?', [key]);
  }

  // ==================== Survey Queue ====================

  async queueSurvey(survey: Omit<SurveyQueueItem, 'syncStatus' | 'syncAttempts' | 'lastSyncError' | 'createdAt'>): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `INSERT INTO survey_queue (localId, teamId, eventId, surveyTypeSlug, responses, ageRange, deviceId, completedAt, durationSeconds, syncStatus, syncAttempts, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        survey.localId,
        survey.teamId,
        survey.eventId,
        survey.surveyTypeSlug,
        survey.responses,
        survey.ageRange,
        survey.deviceId,
        survey.completedAt,
        survey.durationSeconds,
        SYNC_STATUS.PENDING,
        0,
      ]
    );
  }

  async getPendingSurveys(limit: number = 50): Promise<SurveyQueueItem[]> {
    const db = this.getDb();
    return await db.getAllAsync<SurveyQueueItem>(
      `SELECT * FROM survey_queue
       WHERE syncStatus IN (?, ?)
       ORDER BY createdAt ASC
       LIMIT ?`,
      [SYNC_STATUS.PENDING, SYNC_STATUS.FAILED, limit]
    );
  }

  async getSurveyById(localId: string): Promise<SurveyQueueItem | null> {
    const db = this.getDb();
    return await db.getFirstAsync<SurveyQueueItem>(
      'SELECT * FROM survey_queue WHERE localId = ?',
      [localId]
    );
  }

  async markSurveysSyncing(localIds: string[]): Promise<void> {
    if (localIds.length === 0) return;
    const db = this.getDb();
    const placeholders = localIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE survey_queue
       SET syncStatus = ?, syncAttempts = syncAttempts + 1
       WHERE localId IN (${placeholders})`,
      [SYNC_STATUS.SYNCING, ...localIds]
    );
  }

  async markSurveysSynced(localIds: string[]): Promise<void> {
    if (localIds.length === 0) return;
    const db = this.getDb();
    const placeholders = localIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE survey_queue SET syncStatus = ? WHERE localId IN (${placeholders})`,
      [SYNC_STATUS.SYNCED, ...localIds]
    );
  }

  async markSurveyFailed(localId: string, error: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `UPDATE survey_queue
       SET syncStatus = ?, lastSyncError = ?
       WHERE localId = ?`,
      [SYNC_STATUS.FAILED, error, localId]
    );
  }

  async getSurveyQueueCount(): Promise<{ pending: number; synced: number; failed: number }> {
    const db = this.getDb();
    const result = await db.getAllAsync<{ syncStatus: string; count: number }>(
      `SELECT syncStatus, COUNT(*) as count FROM survey_queue GROUP BY syncStatus`
    );
    const counts = { pending: 0, synced: 0, failed: 0 };
    for (const row of result) {
      if (row.syncStatus === SYNC_STATUS.PENDING || row.syncStatus === SYNC_STATUS.SYNCING) {
        counts.pending += row.count;
      } else if (row.syncStatus === SYNC_STATUS.SYNCED) {
        counts.synced = row.count;
      } else if (row.syncStatus === SYNC_STATUS.FAILED) {
        counts.failed = row.count;
      }
    }
    return counts;
  }

  async deleteSyncedSurveys(olderThanDays: number = 7): Promise<number> {
    const db = this.getDb();
    const result = await db.runAsync(
      `DELETE FROM survey_queue
       WHERE syncStatus = ?
       AND datetime(createdAt) < datetime('now', ?)`,
      [SYNC_STATUS.SYNCED, `-${olderThanDays} days`]
    );
    return result.changes;
  }

  // ==================== Pledge Queue ====================

  async queuePledge(pledge: Omit<PledgeQueueItem, 'syncStatus' | 'syncAttempts' | 'lastSyncError'>): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `INSERT INTO pledge_queue (localId, surveyLocalId, teamId, eventId, email, photoLocalId, createdAt, syncStatus, syncAttempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pledge.localId,
        pledge.surveyLocalId,
        pledge.teamId,
        pledge.eventId,
        pledge.email,
        pledge.photoLocalId,
        pledge.createdAt,
        SYNC_STATUS.PENDING,
        0,
      ]
    );
  }

  async getPendingPledges(limit: number = 50): Promise<PledgeQueueItem[]> {
    const db = this.getDb();
    return await db.getAllAsync<PledgeQueueItem>(
      `SELECT * FROM pledge_queue
       WHERE syncStatus IN (?, ?)
       ORDER BY createdAt ASC
       LIMIT ?`,
      [SYNC_STATUS.PENDING, SYNC_STATUS.FAILED, limit]
    );
  }

  async markPledgesSynced(localIds: string[]): Promise<void> {
    if (localIds.length === 0) return;
    const db = this.getDb();
    const placeholders = localIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE pledge_queue SET syncStatus = ? WHERE localId IN (${placeholders})`,
      [SYNC_STATUS.SYNCED, ...localIds]
    );
  }

  async markPledgeFailed(localId: string, error: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `UPDATE pledge_queue
       SET syncStatus = ?, lastSyncError = ?, syncAttempts = syncAttempts + 1
       WHERE localId = ?`,
      [SYNC_STATUS.FAILED, error, localId]
    );
  }

  async getPledgeQueueCount(): Promise<number> {
    const db = this.getDb();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM pledge_queue WHERE syncStatus IN (?, ?)`,
      [SYNC_STATUS.PENDING, SYNC_STATUS.FAILED]
    );
    return result?.count ?? 0;
  }

  // ==================== Photo Cache (Tablet) ====================

  async addToPhotoCache(photo: Omit<PhotoCacheItem, 'status' | 'claimedAt' | 'usedAt' | 'createdAt'>): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO photo_cache (localId, teamId, eventId, localPath, overlayType, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        photo.localId,
        photo.teamId,
        photo.eventId,
        photo.localPath,
        photo.overlayType,
        PHOTO_STATUS.AVAILABLE,
      ]
    );
  }

  async getAvailablePhotos(teamId: string, eventId: string, limit: number = 10): Promise<PhotoCacheItem[]> {
    const db = this.getDb();
    return await db.getAllAsync<PhotoCacheItem>(
      `SELECT * FROM photo_cache
       WHERE teamId = ? AND eventId = ? AND status = ?
       ORDER BY createdAt DESC
       LIMIT ?`,
      [teamId, eventId, PHOTO_STATUS.AVAILABLE, limit]
    );
  }

  async claimPhoto(localId: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `UPDATE photo_cache
       SET status = ?, claimedAt = datetime('now')
       WHERE localId = ?`,
      [PHOTO_STATUS.CLAIMED, localId]
    );
  }

  async markPhotoUsed(localId: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `UPDATE photo_cache
       SET status = ?, usedAt = datetime('now')
       WHERE localId = ?`,
      [PHOTO_STATUS.USED, localId]
    );
  }

  async releasePhoto(localId: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `UPDATE photo_cache
       SET status = ?, claimedAt = NULL
       WHERE localId = ? AND status = ?`,
      [PHOTO_STATUS.AVAILABLE, localId, PHOTO_STATUS.CLAIMED]
    );
  }

  async getPhotoCacheCount(teamId: string, eventId: string): Promise<{ available: number; claimed: number; used: number }> {
    const db = this.getDb();
    const result = await db.getAllAsync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count
       FROM photo_cache
       WHERE teamId = ? AND eventId = ?
       GROUP BY status`,
      [teamId, eventId]
    );
    const counts = { available: 0, claimed: 0, used: 0 };
    for (const row of result) {
      if (row.status === PHOTO_STATUS.AVAILABLE) counts.available = row.count;
      else if (row.status === PHOTO_STATUS.CLAIMED) counts.claimed = row.count;
      else if (row.status === PHOTO_STATUS.USED) counts.used = row.count;
    }
    return counts;
  }

  async clearPhotoCache(teamId: string, eventId: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      'DELETE FROM photo_cache WHERE teamId = ? AND eventId = ?',
      [teamId, eventId]
    );
  }

  // ==================== Photo Queue (Phone) ====================

  async queuePhoto(photo: Omit<PhotoQueueItem, 'uploadStatus' | 'uploadAttempts' | 'remoteUrl' | 'createdAt'>): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `INSERT INTO photo_queue (localId, teamId, eventId, localPath, overlayType, uploadStatus, uploadAttempts, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        photo.localId,
        photo.teamId,
        photo.eventId,
        photo.localPath,
        photo.overlayType,
        UPLOAD_STATUS.PENDING,
        0,
      ]
    );
  }

  async getPendingPhotos(limit: number = 10): Promise<PhotoQueueItem[]> {
    const db = this.getDb();
    return await db.getAllAsync<PhotoQueueItem>(
      `SELECT * FROM photo_queue
       WHERE uploadStatus IN (?, ?)
       ORDER BY createdAt ASC
       LIMIT ?`,
      [UPLOAD_STATUS.PENDING, UPLOAD_STATUS.FAILED, limit]
    );
  }

  async markPhotoUploading(localId: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `UPDATE photo_queue
       SET uploadStatus = ?, uploadAttempts = uploadAttempts + 1
       WHERE localId = ?`,
      [UPLOAD_STATUS.UPLOADING, localId]
    );
  }

  async markPhotoUploaded(localId: string, remoteUrl: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `UPDATE photo_queue
       SET uploadStatus = ?, remoteUrl = ?
       WHERE localId = ?`,
      [UPLOAD_STATUS.UPLOADED, remoteUrl, localId]
    );
  }

  async markPhotoUploadFailed(localId: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `UPDATE photo_queue SET uploadStatus = ? WHERE localId = ?`,
      [UPLOAD_STATUS.FAILED, localId]
    );
  }

  async getPhotoQueueCount(): Promise<number> {
    const db = this.getDb();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM photo_queue WHERE uploadStatus IN (?, ?)`,
      [UPLOAD_STATUS.PENDING, UPLOAD_STATUS.FAILED]
    );
    return result?.count ?? 0;
  }

  async deleteUploadedPhotos(olderThanDays: number = 7): Promise<number> {
    const db = this.getDb();
    const result = await db.runAsync(
      `DELETE FROM photo_queue
       WHERE uploadStatus = ?
       AND datetime(createdAt) < datetime('now', ?)`,
      [UPLOAD_STATUS.UPLOADED, `-${olderThanDays} days`]
    );
    return result.changes;
  }

  // ==================== Current Event ====================

  async getCurrentEvent(): Promise<CurrentEvent | null> {
    const db = this.getDb();
    return await db.getFirstAsync<CurrentEvent>(
      'SELECT * FROM current_event WHERE id = 1'
    );
  }

  async setCurrentEvent(event: Omit<CurrentEvent, 'id'>): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO current_event (id, eventId, teamId, teamCode, venueName, surveyTypes, overlayType, activeSurveyType, startedAt)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventId,
        event.teamId,
        event.teamCode,
        event.venueName,
        event.surveyTypes,
        event.overlayType,
        event.activeSurveyType,
        event.startedAt,
      ]
    );
  }

  async updateActiveSurveyType(surveyType: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      'UPDATE current_event SET activeSurveyType = ? WHERE id = 1',
      [surveyType]
    );
  }

  async clearCurrentEvent(): Promise<void> {
    const db = this.getDb();
    await db.runAsync('DELETE FROM current_event WHERE id = 1');
  }

  // ==================== Cleanup & Maintenance ====================

  async resetDatabase(): Promise<void> {
    const db = this.getDb();
    await db.execAsync(`
      DELETE FROM device_config;
      DELETE FROM survey_queue;
      DELETE FROM pledge_queue;
      DELETE FROM photo_cache;
      DELETE FROM photo_queue;
      DELETE FROM current_event;
    `);
    console.log('[DatabaseService] Database reset complete');
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      console.log('[DatabaseService] Database connection closed');
    }
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
