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
  type TodayStats,
  type ActivityItem,
  SYNC_STATUS,
  UPLOAD_STATUS,
  PHOTO_STATUS,
} from './schema';

/** "jordan@email.com" -> "j***@email.com" */
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [name, domain] = email.split('@');
  if (!domain) return '***';
  return `${name.slice(0, 1)}***@${domain}`;
}

export class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(DATABASE_NAME);

      // Create all tables. execAsync runs multiple statements (and handles
      // SQL comments) in a single call, so we pass the whole schema at once.
      await this.db.execAsync(CREATE_TABLES_SQL);

      // Lightweight migrations for existing databases (safe to run repeatedly).
      await this.runMigrations();

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

  /**
   * Add columns to existing databases that predate them.
   * SQLite lacks "ADD COLUMN IF NOT EXISTS", so we swallow the
   * "duplicate column" error that occurs when already migrated.
   */
  private async runMigrations(): Promise<void> {
    const db = this.getDb();
    const alters = [
      `ALTER TABLE pledge_queue ADD COLUMN photoId TEXT`,
      `ALTER TABLE pledge_queue ADD COLUMN compositedPhotoUrl TEXT`,
    ];
    for (const sql of alters) {
      try {
        await db.execAsync(sql);
      } catch {
        // Column already exists — ignore.
      }
    }
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

  /**
   * Attach the age range collected on the demographics screen, which is shown
   * after the survey has already been queued.
   */
  async updateSurveyAgeRange(localId: string, ageRange: string | null): Promise<void> {
    const db = this.getDb();
    await db.runAsync('UPDATE survey_queue SET ageRange = ? WHERE localId = ?', [
      ageRange,
      localId,
    ]);
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

  /**
   * Put a batch back in the queue after an attempt that never got an answer.
   *
   * Rows are marked "syncing" before the request goes out, and `getPendingSurveys`
   * only ever returns "pending" and "failed". So a request that throws — dropped
   * wifi, a gateway timeout, the venue's captive portal — used to leave its whole
   * batch parked in "syncing", which nothing selects. Those surveys were never
   * retried and never sent, on that shift or any shift after it.
   *
   * Failing is fine. Losing the row is not: it goes back to "pending" so the next
   * pass picks it up.
   */
  async markSurveysPending(localIds: string[]): Promise<void> {
    if (localIds.length === 0) return;
    const db = this.getDb();
    const placeholders = localIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE survey_queue SET syncStatus = ? WHERE localId IN (${placeholders})`,
      [SYNC_STATUS.PENDING, ...localIds]
    );
  }

  /**
   * Requeue anything left mid-flight, for the same reason as above but for the
   * cases no catch block can cover: the app being killed, the tablet dying, or
   * Android stopping the process while a request was open. Run at startup, when
   * nothing can legitimately be in flight.
   *
   * Photos have the identical hole — "uploading" is not in the set
   * `getPendingPhotos` selects — so they are recovered here too.
   */
  async recoverInterruptedSyncs(): Promise<{ surveys: number; photos: number }> {
    const db = this.getDb();

    const surveys = await db.runAsync(
      `UPDATE survey_queue SET syncStatus = ? WHERE syncStatus = ?`,
      [SYNC_STATUS.PENDING, SYNC_STATUS.SYNCING]
    );

    const photos = await db.runAsync(
      `UPDATE photo_queue SET uploadStatus = ? WHERE uploadStatus = ?`,
      [UPLOAD_STATUS.PENDING, UPLOAD_STATUS.UPLOADING]
    );

    return { surveys: surveys.changes ?? 0, photos: photos.changes ?? 0 };
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

  /**
   * Counts for everything collected on this device today, read straight from the
   * local queues so the numbers are correct even with no connectivity.
   */
  async getTodayStats(): Promise<TodayStats> {
    const db = this.getDb();

    const surveyRows = await db.getAllAsync<{ surveyTypeSlug: string; count: number }>(
      `SELECT surveyTypeSlug, COUNT(*) as count FROM survey_queue
       WHERE date(completedAt) = date('now', 'localtime')
       GROUP BY surveyTypeSlug`
    );

    const pledgeRow = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM pledge_queue
       WHERE date(createdAt) = date('now', 'localtime')`
    );

    const photoRow = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM photo_queue
       WHERE date(createdAt) = date('now', 'localtime')`
    );

    return {
      surveys: surveyRows.reduce((sum, row) => sum + row.count, 0),
      pledges: pledgeRow?.count ?? 0,
      photos: photoRow?.count ?? 0,
      surveysByType: surveyRows.map((row) => ({
        surveyTypeSlug: row.surveyTypeSlug,
        count: row.count,
      })),
    };
  }

  /**
   * Most recent surveys, pledges and photos captured on this device, newest
   * first. Emails are masked so the dashboard can be shown in public.
   */
  async getRecentActivity(limit: number = 5): Promise<ActivityItem[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<{
      id: string;
      type: string;
      label: string | null;
      at: string;
    }>(
      `SELECT localId as id, 'survey' as type, surveyTypeSlug as label, completedAt as at FROM survey_queue
       UNION ALL
       SELECT localId as id, 'pledge' as type, email as label, createdAt as at FROM pledge_queue
       UNION ALL
       SELECT localId as id, 'photo' as type, NULL as label, createdAt as at FROM photo_queue
       ORDER BY at DESC
       LIMIT ?`,
      [limit]
    );

    return rows.map((row) => ({
      id: row.id,
      type: row.type as ActivityItem['type'],
      label: row.type === 'pledge' ? maskEmail(row.label) : row.label,
      at: row.at,
    }));
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
      `INSERT INTO pledge_queue (localId, surveyLocalId, teamId, eventId, email, photoLocalId, photoId, compositedPhotoUrl, createdAt, syncStatus, syncAttempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pledge.localId,
        pledge.surveyLocalId,
        pledge.teamId,
        pledge.eventId,
        pledge.email,
        pledge.photoLocalId,
        pledge.photoId ?? null,
        pledge.compositedPhotoUrl ?? null,
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

  /**
   * Look up cached photos (tablet) by their server localIds so their
   * local files can be removed during deletion propagation.
   */
  async getPhotoCacheByLocalIds(localIds: string[]): Promise<PhotoCacheItem[]> {
    if (localIds.length === 0) return [];
    const db = this.getDb();
    const placeholders = localIds.map(() => '?').join(',');
    return await db.getAllAsync<PhotoCacheItem>(
      `SELECT * FROM photo_cache WHERE localId IN (${placeholders})`,
      localIds
    );
  }

  /** Remove cached photo rows (tablet) matching the given localIds. */
  async deletePhotoCacheByLocalIds(localIds: string[]): Promise<void> {
    if (localIds.length === 0) return;
    const db = this.getDb();
    const placeholders = localIds.map(() => '?').join(',');
    await db.runAsync(
      `DELETE FROM photo_cache WHERE localId IN (${placeholders})`,
      localIds
    );
  }

  /**
   * Look up queued phone photos by localId so their local files can be
   * removed during deletion propagation.
   */
  async getPhotoQueueByLocalIds(localIds: string[]): Promise<PhotoQueueItem[]> {
    if (localIds.length === 0) return [];
    const db = this.getDb();
    const placeholders = localIds.map(() => '?').join(',');
    return await db.getAllAsync<PhotoQueueItem>(
      `SELECT * FROM photo_queue WHERE localId IN (${placeholders})`,
      localIds
    );
  }

  /** Remove queued phone photo rows matching the given localIds. */
  async deletePhotoQueueByLocalIds(localIds: string[]): Promise<void> {
    if (localIds.length === 0) return;
    const db = this.getDb();
    const placeholders = localIds.map(() => '?').join(',');
    await db.runAsync(
      `DELETE FROM photo_queue WHERE localId IN (${placeholders})`,
      localIds
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
