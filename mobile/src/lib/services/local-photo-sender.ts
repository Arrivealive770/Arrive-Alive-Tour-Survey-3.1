// Photo Sender Service
// Runs on PHONE devices (Photo Hub) to push a freshly-taken photo to the
// backend straight away, so the tablets running the pledge kiosk can see it
// within seconds instead of waiting for the next background sync.
//
// It uploads to the same endpoint the background sync uses
// (POST /api/photos/upload), which is idempotent on localId — so a photo that
// gets sent by both paths is only ever stored once.
//
// If the upload fails (no signal, venue wifi dropped) the photo is queued to
// disk and retried with exponential backoff. Nothing is ever lost: the photo
// also sits in the phone's SQLite photo queue as a backstop.

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { useDeviceStore } from '@/lib/state/device-store';
import { getDatabaseSafe } from '@/lib/db/database';
import { BACKEND_URL } from '@/lib/api/backend-url';

// Directory where queued photos for transfer are tracked
const LOCAL_SEND_QUEUE_DIR = 'local_send_queue/';

// Metadata that travels with a photo
export interface PhotoSendMetadata {
  localId: string;
  teamId: string;
  eventId: string;
  overlayType: string;
}

// Queue item stored locally when transfer fails
export interface QueuedPhotoItem {
  localId: string;
  teamId: string;
  eventId: string;
  overlayType: string;
  localPath: string; // Path to the original photo file
  attempts: number;
  lastAttempt: string | null;
  lastError: string | null;
  queuedAt: string;
}

// Result of a send operation
export interface LocalSendResult {
  success: boolean;
  localId: string;
  remoteUrl?: string | null;
  error?: string;
}

// Sender status
export type SenderStatus = 'stopped' | 'running' | 'sending' | 'error';

// Retry configuration
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 5,
  baseDelayMs: 3000,
  multiplier: 2,
};

// Photos can be a couple of MB over venue wifi — give them room.
const UPLOAD_TIMEOUT_MS = 60000;

interface PhotoUploadApiResponse {
  data?: {
    success?: boolean;
    localId?: string;
    remoteUrl?: string | null;
  };
  error?: { message?: string; code?: string };
}

class LocalPhotoSenderService {
  private status: SenderStatus = 'stopped';
  private sentCount = 0;
  private failedCount = 0;
  private lastError: string | null = null;
  private isInitialized = false;
  private sendQueue: Map<string, QueuedPhotoItem> = new Map();
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private autoRetryEnabled = true;

  private get baseUrl(): string {
    return BACKEND_URL;
  }

  /**
   * Initialize the sender service
   * Creates the queue directory and loads any previously queued photos
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[LocalPhotoSender] Already initialized');
      return;
    }

    // Skip on web since FileSystem APIs are not fully available
    if (Platform.OS === 'web') {
      console.log('[LocalPhotoSender] Not supported on web platform');
      return;
    }

    try {
      // Ensure the queue directory exists
      const dirPath = `${FileSystem.documentDirectory}${LOCAL_SEND_QUEUE_DIR}`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
        console.log('[LocalPhotoSender] Created send queue directory:', dirPath);
      }

      // Load any previously queued items from disk
      await this.loadQueueFromDisk();

      this.isInitialized = true;
      console.log('[LocalPhotoSender] Initialized successfully');
      console.log('[LocalPhotoSender] Queued photos from previous session:', this.sendQueue.size);
    } catch (error) {
      console.error('[LocalPhotoSender] Failed to initialize:', error);
      this.lastError = error instanceof Error ? error.message : 'Unknown initialization error';
      throw error;
    }
  }

  /**
   * Load previously queued photos from disk
   */
  private async loadQueueFromDisk(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      const queueFilePath = `${FileSystem.documentDirectory}${LOCAL_SEND_QUEUE_DIR}queue.json`;
      const fileInfo = await FileSystem.getInfoAsync(queueFilePath);

      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(queueFilePath);
        const items: QueuedPhotoItem[] = JSON.parse(content);

        for (const item of items) {
          // Verify the photo file still exists
          const photoInfo = await FileSystem.getInfoAsync(item.localPath);
          if (photoInfo.exists) {
            this.sendQueue.set(item.localId, item);
          } else {
            console.log('[LocalPhotoSender] Photo file no longer exists, skipping:', item.localId);
          }
        }

        console.log('[LocalPhotoSender] Loaded queue from disk:', this.sendQueue.size, 'items');
      }
    } catch (error) {
      console.error('[LocalPhotoSender] Failed to load queue from disk:', error);
    }
  }

  /**
   * Save the current queue to disk
   */
  private async saveQueueToDisk(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      const queueFilePath = `${FileSystem.documentDirectory}${LOCAL_SEND_QUEUE_DIR}queue.json`;
      const items = Array.from(this.sendQueue.values());
      await FileSystem.writeAsStringAsync(queueFilePath, JSON.stringify(items));
      console.log('[LocalPhotoSender] Saved queue to disk:', items.length, 'items');
    } catch (error) {
      console.error('[LocalPhotoSender] Failed to save queue to disk:', error);
    }
  }

  /**
   * Start the sender service
   */
  async start(): Promise<void> {
    // Check if this device is a phone
    const deviceType = useDeviceStore.getState().deviceType;
    if (deviceType !== 'phone') {
      console.log('[LocalPhotoSender] Service is only for phone devices, current type:', deviceType);
      return;
    }

    if (this.status === 'running' || this.status === 'sending') {
      console.log('[LocalPhotoSender] Sender already running');
      return;
    }

    try {
      await this.initialize();

      this.status = 'running';
      this.lastError = null;

      console.log('[LocalPhotoSender] Sender started, target:', this.baseUrl);

      // Start processing queue if there are pending items
      if (this.sendQueue.size > 0) {
        console.log('[LocalPhotoSender] Processing queued photos...');
        this.scheduleQueueProcessing(1000);
      }
    } catch (error) {
      console.error('[LocalPhotoSender] Failed to start sender:', error);
      this.status = 'error';
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Stop the sender service
   */
  stop(): void {
    if (this.status === 'stopped') {
      console.log('[LocalPhotoSender] Sender already stopped');
      return;
    }

    // Cancel any pending retry
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.status = 'stopped';
    console.log('[LocalPhotoSender] Sender stopped');
    console.log('[LocalPhotoSender] Session stats - Sent:', this.sentCount, ', Failed:', this.failedCount);
  }

  /**
   * Check that the backend (the thing the tablets read from) is reachable.
   */
  async checkConnection(): Promise<boolean> {
    if (!this.baseUrl) {
      console.log('[LocalPhotoSender] Backend URL not configured');
      return false;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      console.log(
        '[LocalPhotoSender] Backend not reachable:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return false;
    }
  }

  /**
   * Send a photo so the tablets can pick it up.
   *
   * @param localPath - Path to the photo file
   * @param metadata - Photo metadata (localId, teamId, eventId, overlayType)
   */
  async sendPhotoFromPath(
    localPath: string,
    metadata: PhotoSendMetadata
  ): Promise<LocalSendResult> {
    console.log('[LocalPhotoSender] Sending photo:', metadata.localId);

    if (Platform.OS === 'web') {
      return {
        success: false,
        localId: metadata.localId,
        error: 'Photo sending not supported on web platform',
      };
    }

    if (!this.baseUrl) {
      const error = 'Backend URL is not configured';
      console.error('[LocalPhotoSender]', error);
      await this.queuePhoto(localPath, metadata, error);
      return { success: false, localId: metadata.localId, error };
    }

    this.status = 'sending';

    try {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists) {
        throw new Error('Photo file not found at path: ' + localPath);
      }

      const deviceId = useDeviceStore.getState().deviceId;

      // Stream the file itself rather than base64 — a 4MB photo becomes a
      // ~5.5MB string otherwise, which is slow and memory-hungry on a phone.
      const formData = new FormData();
      formData.append('file', {
        uri: localPath,
        type: 'image/jpeg',
        name: `${metadata.localId}.jpg`,
      } as unknown as Blob);
      formData.append('localId', metadata.localId);
      formData.append('teamId', metadata.teamId);
      formData.append('eventId', metadata.eventId);
      formData.append('overlayType', metadata.overlayType);
      // Lets the backend know which phone to let clean up its original later.
      if (deviceId) {
        formData.append('deviceId', deviceId);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/api/photos/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const payload = (await response.json().catch(() => null)) as PhotoUploadApiResponse | null;

      if (!response.ok || payload?.data?.success !== true) {
        throw new Error(
          payload?.error?.message ?? `Server responded with status: ${response.status}`
        );
      }

      const remoteUrl = payload?.data?.remoteUrl ?? null;
      console.log('[LocalPhotoSender] Photo delivered:', metadata.localId);
      this.sentCount++;

      // Mark it uploaded locally so the background sync doesn't queue it again
      // and the "waiting to send" badge on the phone clears right away.
      try {
        const db = getDatabaseSafe();
        if (db && remoteUrl) {
          await db.markPhotoUploaded(metadata.localId, remoteUrl);
        }
      } catch (dbError) {
        console.error('[LocalPhotoSender] Could not mark photo uploaded:', dbError);
      }

      // Remove from retry queue if it was queued
      if (this.sendQueue.has(metadata.localId)) {
        this.sendQueue.delete(metadata.localId);
        await this.saveQueueToDisk();
      }

      this.status = 'running';
      return { success: true, localId: metadata.localId, remoteUrl };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocalPhotoSender] Failed to send photo:', errorMessage);

      this.failedCount++;
      this.lastError = errorMessage;
      this.status = 'running';

      // Queue for retry — the photo is still safe in the phone's SQLite queue.
      await this.queuePhoto(localPath, metadata, errorMessage);

      return { success: false, localId: metadata.localId, error: errorMessage };
    }
  }

  /**
   * Queue a photo for retry when transfer fails
   */
  private async queuePhoto(
    localPath: string,
    metadata: PhotoSendMetadata,
    error: string
  ): Promise<void> {
    const existingItem = this.sendQueue.get(metadata.localId);

    const queueItem: QueuedPhotoItem = {
      localId: metadata.localId,
      teamId: metadata.teamId,
      eventId: metadata.eventId,
      overlayType: metadata.overlayType,
      localPath,
      attempts: existingItem ? existingItem.attempts + 1 : 1,
      lastAttempt: new Date().toISOString(),
      lastError: error,
      queuedAt: existingItem?.queuedAt || new Date().toISOString(),
    };

    this.sendQueue.set(metadata.localId, queueItem);
    console.log('[LocalPhotoSender] Photo queued for retry:', metadata.localId, 'Attempt:', queueItem.attempts);

    await this.saveQueueToDisk();

    // Schedule retry if auto-retry is enabled
    if (this.autoRetryEnabled && queueItem.attempts < DEFAULT_RETRY_CONFIG.maxAttempts) {
      const delay = this.calculateRetryDelay(queueItem.attempts);
      this.scheduleQueueProcessing(delay);
    }
  }

  /**
   * Calculate retry delay based on attempt number using exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    return DEFAULT_RETRY_CONFIG.baseDelayMs * Math.pow(DEFAULT_RETRY_CONFIG.multiplier, attempt - 1);
  }

  /**
   * Schedule processing of the send queue
   */
  private scheduleQueueProcessing(delayMs: number): void {
    // Clear any existing timeout
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    console.log('[LocalPhotoSender] Scheduling queue processing in', delayMs, 'ms');

    this.retryTimeout = setTimeout(async () => {
      this.retryTimeout = null;
      await this.sendQueuedPhotos();
    }, delayMs);
  }

  /**
   * Send all queued photos
   */
  async sendQueuedPhotos(): Promise<{ sent: number; failed: number; remaining: number }> {
    console.log('[LocalPhotoSender] Processing queued photos. Queue size:', this.sendQueue.size);

    if (this.sendQueue.size === 0) {
      return { sent: 0, failed: 0, remaining: 0 };
    }

    // Don't burn through retry attempts while there's no connection at all.
    const isConnected = await this.checkConnection();
    if (!isConnected) {
      console.log('[LocalPhotoSender] Backend not reachable, will retry later');
      this.scheduleQueueProcessing(DEFAULT_RETRY_CONFIG.baseDelayMs);
      return { sent: 0, failed: 0, remaining: this.sendQueue.size };
    }

    let sent = 0;
    let failed = 0;
    const itemsToRemove: string[] = [];

    for (const [localId, item] of this.sendQueue) {
      // Give up on items that have exceeded max attempts — the background sync
      // service still has them in the SQLite queue and keeps trying.
      if (item.attempts >= DEFAULT_RETRY_CONFIG.maxAttempts) {
        console.log('[LocalPhotoSender] Photo exceeded max attempts, handing off to background sync:', localId);
        itemsToRemove.push(localId);
        failed++;
        continue;
      }

      const fileInfo = await FileSystem.getInfoAsync(item.localPath);
      if (!fileInfo.exists) {
        console.log('[LocalPhotoSender] Photo file no longer exists:', localId);
        itemsToRemove.push(localId);
        failed++;
        continue;
      }

      console.log('[LocalPhotoSender] Retrying photo:', localId, 'Attempt:', item.attempts + 1);

      // sendPhotoFromPath re-queues (and bumps attempts) on failure, and
      // removes the item from the queue on success.
      const result = await this.sendPhotoFromPath(item.localPath, {
        localId: item.localId,
        teamId: item.teamId,
        eventId: item.eventId,
        overlayType: item.overlayType,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    // Remove items that exceeded max attempts or no longer exist
    for (const localId of itemsToRemove) {
      this.sendQueue.delete(localId);
    }

    await this.saveQueueToDisk();

    const remaining = this.sendQueue.size;
    console.log('[LocalPhotoSender] Queue processing complete. Sent:', sent, 'Failed:', failed, 'Remaining:', remaining);

    return { sent, failed, remaining };
  }

  /**
   * Get the number of photos waiting to be sent
   */
  getQueuedCount(): number {
    return this.sendQueue.size;
  }

  /**
   * Get all queued photos
   */
  getQueuedPhotos(): QueuedPhotoItem[] {
    return Array.from(this.sendQueue.values());
  }

  /**
   * Get the current status of the sender
   */
  getStatus(): SenderStatus {
    return this.status;
  }

  /**
   * Get the number of photos sent in the current session
   */
  getSentCount(): number {
    return this.sentCount;
  }

  /**
   * Get the number of failed sends in the current session
   */
  getFailedCount(): number {
    return this.failedCount;
  }

  /**
   * Get the last error message if any
   */
  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Enable or disable automatic retry
   */
  setAutoRetry(enabled: boolean): void {
    this.autoRetryEnabled = enabled;
    console.log('[LocalPhotoSender] Auto retry', enabled ? 'enabled' : 'disabled');

    if (!enabled && this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  /**
   * Clear a specific photo from the queue
   */
  async clearQueuedPhoto(localId: string): Promise<boolean> {
    if (this.sendQueue.has(localId)) {
      this.sendQueue.delete(localId);
      await this.saveQueueToDisk();
      console.log('[LocalPhotoSender] Removed photo from queue:', localId);
      return true;
    }
    return false;
  }

  /**
   * Clear all photos from the queue
   */
  async clearQueue(): Promise<number> {
    const count = this.sendQueue.size;
    this.sendQueue.clear();
    await this.saveQueueToDisk();
    console.log('[LocalPhotoSender] Cleared queue:', count, 'items');
    return count;
  }

  /**
   * Get statistics about the sender
   */
  getStats(): {
    status: SenderStatus;
    sentCount: number;
    failedCount: number;
    queuedCount: number;
    lastError: string | null;
    autoRetryEnabled: boolean;
  } {
    return {
      status: this.status,
      sentCount: this.sentCount,
      failedCount: this.failedCount,
      queuedCount: this.sendQueue.size,
      lastError: this.lastError,
      autoRetryEnabled: this.autoRetryEnabled,
    };
  }

  /**
   * Cleanup the service
   */
  cleanup(): void {
    this.stop();
    this.sendQueue.clear();
    this.isInitialized = false;
    console.log('[LocalPhotoSender] Cleanup complete');
  }
}

// Singleton instance
let localPhotoSenderInstance: LocalPhotoSenderService | null = null;

/**
 * Get the LocalPhotoSenderService singleton instance
 */
export function getLocalPhotoSenderService(): LocalPhotoSenderService {
  if (!localPhotoSenderInstance) {
    localPhotoSenderInstance = new LocalPhotoSenderService();
  }
  return localPhotoSenderInstance;
}

/**
 * Initialize and start the local photo sender service
 */
export async function initializeLocalPhotoSender(): Promise<LocalPhotoSenderService> {
  const service = getLocalPhotoSenderService();
  await service.start();
  return service;
}

/**
 * Cleanup the local photo sender service
 */
export function cleanupLocalPhotoSender(): void {
  if (localPhotoSenderInstance) {
    localPhotoSenderInstance.cleanup();
    localPhotoSenderInstance = null;
  }
}

export { LocalPhotoSenderService };
