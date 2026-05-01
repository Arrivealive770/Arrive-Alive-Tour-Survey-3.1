// Local Photo Sender Service
// Runs on PHONE devices to send photos directly to a tablet via local hotspot network
// Handles offline/connection failures gracefully with queuing and retry logic

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { useDeviceStore } from '@/lib/state/device-store';
import type { PhotoReceiverResponse } from './local-photo-receiver';

// Directory where queued photos for local transfer are stored
const LOCAL_SEND_QUEUE_DIR = 'local_send_queue/';

// Photo data format for local transfer
export interface LocalPhotoData {
  localId: string;
  teamId: string;
  eventId: string;
  overlayType: string;
  photoBase64: string; // Base64 encoded JPEG
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

class LocalPhotoSenderService {
  private status: SenderStatus = 'stopped';
  private sentCount = 0;
  private failedCount = 0;
  private lastError: string | null = null;
  private isInitialized = false;
  private sendQueue: Map<string, QueuedPhotoItem> = new Map();
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private autoRetryEnabled = true;

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

    // Check if local photo transfer is enabled
    const localPhotoTransferEnabled = useDeviceStore.getState().localPhotoTransferEnabled;
    if (!localPhotoTransferEnabled) {
      console.log('[LocalPhotoSender] Local photo transfer is not enabled');
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

      const tabletIp = useDeviceStore.getState().tabletLocalIp;
      const tabletPort = useDeviceStore.getState().tabletLocalPort;

      console.log('[LocalPhotoSender] Sender started');
      console.log('[LocalPhotoSender] Target tablet IP:', tabletIp || 'Not configured');
      console.log('[LocalPhotoSender] Target tablet port:', tabletPort);

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
   * Check if the tablet is reachable
   */
  async checkTabletConnection(): Promise<boolean> {
    const tabletIp = useDeviceStore.getState().tabletLocalIp;
    const tabletPort = useDeviceStore.getState().tabletLocalPort;

    if (!tabletIp) {
      console.log('[LocalPhotoSender] Tablet IP not configured');
      return false;
    }

    const tabletUrl = `http://${tabletIp}:${tabletPort}/api/local-photos/health`;

    console.log('[LocalPhotoSender] Checking tablet connection:', tabletUrl);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(tabletUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const isReachable = response.ok;
      console.log('[LocalPhotoSender] Tablet reachable:', isReachable);
      return isReachable;
    } catch (error) {
      console.log('[LocalPhotoSender] Tablet not reachable:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Send a photo directly from a file path
   *
   * @param localPath - Path to the photo file
   * @param metadata - Photo metadata (localId, teamId, eventId, overlayType)
   * @returns Result of the send operation
   */
  async sendPhotoFromPath(
    localPath: string,
    metadata: Omit<LocalPhotoData, 'photoBase64'>
  ): Promise<LocalSendResult> {
    console.log('[LocalPhotoSender] Sending photo from path:', localPath);
    console.log('[LocalPhotoSender] Photo metadata:', metadata);

    // Check if local transfer is enabled
    const localPhotoTransferEnabled = useDeviceStore.getState().localPhotoTransferEnabled;
    if (!localPhotoTransferEnabled) {
      console.log('[LocalPhotoSender] Local photo transfer not enabled, skipping');
      return {
        success: false,
        localId: metadata.localId,
        error: 'Local photo transfer is not enabled',
      };
    }

    // Skip on web platform
    if (Platform.OS === 'web') {
      return {
        success: false,
        localId: metadata.localId,
        error: 'Photo sending not supported on web platform',
      };
    }

    try {
      // Read the photo file as base64
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists) {
        throw new Error('Photo file not found at path: ' + localPath);
      }

      const photoBase64 = await FileSystem.readAsStringAsync(localPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('[LocalPhotoSender] Read photo file, base64 length:', photoBase64.length);

      // Send the photo
      return this.sendPhoto({
        ...metadata,
        photoBase64,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocalPhotoSender] Failed to read photo file:', errorMessage);

      // Queue for retry
      await this.queuePhoto(localPath, metadata, errorMessage);

      return {
        success: false,
        localId: metadata.localId,
        error: errorMessage,
      };
    }
  }

  /**
   * Send a photo to the tablet
   *
   * @param photoData - The photo data including base64 encoded image
   * @returns Result of the send operation
   */
  async sendPhoto(photoData: LocalPhotoData): Promise<LocalSendResult> {
    console.log('[LocalPhotoSender] Attempting to send photo:', photoData.localId);

    // Check if local transfer is enabled
    const localPhotoTransferEnabled = useDeviceStore.getState().localPhotoTransferEnabled;
    if (!localPhotoTransferEnabled) {
      console.log('[LocalPhotoSender] Local photo transfer not enabled, skipping');
      return {
        success: false,
        localId: photoData.localId,
        error: 'Local photo transfer is not enabled',
      };
    }

    const tabletIp = useDeviceStore.getState().tabletLocalIp;
    const tabletPort = useDeviceStore.getState().tabletLocalPort;

    if (!tabletIp) {
      const error = 'Tablet IP address not configured';
      console.error('[LocalPhotoSender]', error);
      return {
        success: false,
        localId: photoData.localId,
        error,
      };
    }

    const tabletUrl = `http://${tabletIp}:${tabletPort}/api/local-photos/receive`;

    console.log('[LocalPhotoSender] Sending to:', tabletUrl);
    console.log('[LocalPhotoSender] Photo base64 length:', photoData.photoBase64.length);

    this.status = 'sending';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout for photo upload

      const response = await fetch(tabletUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          localId: photoData.localId,
          teamId: photoData.teamId,
          eventId: photoData.eventId,
          overlayType: photoData.overlayType,
          photoBase64: photoData.photoBase64,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = (await response.json()) as PhotoReceiverResponse;

      if (result.success) {
        console.log('[LocalPhotoSender] Photo sent successfully:', photoData.localId);
        this.sentCount++;

        // Remove from queue if it was queued
        if (this.sendQueue.has(photoData.localId)) {
          this.sendQueue.delete(photoData.localId);
          await this.saveQueueToDisk();
        }

        this.status = 'running';
        return {
          success: true,
          localId: photoData.localId,
        };
      } else {
        throw new Error(result.error || 'Tablet reported failure');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocalPhotoSender] Failed to send photo:', errorMessage);

      this.failedCount++;
      this.lastError = errorMessage;
      this.status = 'running';

      return {
        success: false,
        localId: photoData.localId,
        error: errorMessage,
      };
    }
  }

  /**
   * Queue a photo for retry when transfer fails
   */
  private async queuePhoto(
    localPath: string,
    metadata: Omit<LocalPhotoData, 'photoBase64'>,
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
      console.log('[LocalPhotoSender] No photos in queue');
      return { sent: 0, failed: 0, remaining: 0 };
    }

    // Check if local transfer is enabled
    const localPhotoTransferEnabled = useDeviceStore.getState().localPhotoTransferEnabled;
    if (!localPhotoTransferEnabled) {
      console.log('[LocalPhotoSender] Local photo transfer not enabled, skipping queue processing');
      return { sent: 0, failed: 0, remaining: this.sendQueue.size };
    }

    // Check tablet connection first
    const isConnected = await this.checkTabletConnection();
    if (!isConnected) {
      console.log('[LocalPhotoSender] Tablet not reachable, will retry later');

      // Schedule retry
      this.scheduleQueueProcessing(DEFAULT_RETRY_CONFIG.baseDelayMs);

      return { sent: 0, failed: 0, remaining: this.sendQueue.size };
    }

    let sent = 0;
    let failed = 0;
    const itemsToRemove: string[] = [];

    for (const [localId, item] of this.sendQueue) {
      // Skip items that have exceeded max attempts
      if (item.attempts >= DEFAULT_RETRY_CONFIG.maxAttempts) {
        console.log('[LocalPhotoSender] Photo exceeded max attempts, removing:', localId);
        itemsToRemove.push(localId);
        failed++;
        continue;
      }

      console.log('[LocalPhotoSender] Retrying photo:', localId, 'Attempt:', item.attempts + 1);

      try {
        // Read the photo file
        const fileInfo = await FileSystem.getInfoAsync(item.localPath);
        if (!fileInfo.exists) {
          console.log('[LocalPhotoSender] Photo file no longer exists:', localId);
          itemsToRemove.push(localId);
          failed++;
          continue;
        }

        const photoBase64 = await FileSystem.readAsStringAsync(item.localPath, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Update attempt count before sending
        item.attempts++;
        item.lastAttempt = new Date().toISOString();
        this.sendQueue.set(localId, item);

        // Try to send
        const result = await this.sendPhoto({
          localId: item.localId,
          teamId: item.teamId,
          eventId: item.eventId,
          overlayType: item.overlayType,
          photoBase64,
        });

        if (result.success) {
          sent++;
          // sendPhoto already removes from queue on success
        } else {
          item.lastError = result.error || 'Unknown error';
          this.sendQueue.set(localId, item);

          if (item.attempts >= DEFAULT_RETRY_CONFIG.maxAttempts) {
            console.log('[LocalPhotoSender] Photo reached max attempts:', localId);
            itemsToRemove.push(localId);
            failed++;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[LocalPhotoSender] Error processing queued photo:', errorMessage);
        item.lastError = errorMessage;
        item.attempts++;
        this.sendQueue.set(localId, item);

        if (item.attempts >= DEFAULT_RETRY_CONFIG.maxAttempts) {
          itemsToRemove.push(localId);
          failed++;
        }
      }
    }

    // Remove items that exceeded max attempts or no longer exist
    for (const localId of itemsToRemove) {
      this.sendQueue.delete(localId);
    }

    await this.saveQueueToDisk();

    const remaining = this.sendQueue.size;
    console.log('[LocalPhotoSender] Queue processing complete. Sent:', sent, 'Failed:', failed, 'Remaining:', remaining);

    // Schedule another retry if there are remaining items
    if (remaining > 0 && this.autoRetryEnabled) {
      this.scheduleQueueProcessing(DEFAULT_RETRY_CONFIG.baseDelayMs);
    }

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
