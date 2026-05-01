// Local Photo Receiver Service
// Runs on TABLET devices to receive photos from phones connected via hotspot
// Since React Native cannot run a true HTTP server, this service uses a polling approach
// and provides methods to process incoming photo data

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getDatabaseSafe } from '@/lib/db/database';
import { useDeviceStore } from '@/lib/state/device-store';
import { usePhotoCacheStore, type CachedPhoto } from '@/lib/state/photo-cache-store';

// Directory where received photos are stored
const LOCAL_PHOTOS_DIR = 'local_photos/';

// Request format for incoming photos from phones
export interface IncomingPhotoRequest {
  localId: string;
  teamId: string;
  eventId: string;
  overlayType: string;
  photoBase64: string;
}

// Response format sent back to phones
export interface PhotoReceiverResponse {
  success: boolean;
  localId: string;
  error?: string;
}

// Receiver status
export type ReceiverStatus = 'stopped' | 'running' | 'error';

class LocalPhotoReceiverService {
  private status: ReceiverStatus = 'stopped';
  private receivedCount = 0;
  private lastError: string | null = null;
  private isInitialized = false;

  /**
   * Initialize the receiver service
   * Creates the local photos directory if it doesn't exist
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[LocalPhotoReceiver] Already initialized');
      return;
    }

    // Skip on web since FileSystem APIs are not fully available
    if (Platform.OS === 'web') {
      console.log('[LocalPhotoReceiver] Not supported on web platform');
      return;
    }

    try {
      // Ensure the local photos directory exists
      const dirPath = `${FileSystem.documentDirectory}${LOCAL_PHOTOS_DIR}`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
        console.log('[LocalPhotoReceiver] Created local photos directory:', dirPath);
      }

      this.isInitialized = true;
      console.log('[LocalPhotoReceiver] Initialized successfully');
    } catch (error) {
      console.error('[LocalPhotoReceiver] Failed to initialize:', error);
      this.lastError = error instanceof Error ? error.message : 'Unknown initialization error';
      throw error;
    }
  }

  /**
   * Start the photo receiver
   * On tablets, this prepares the service to accept incoming photos
   */
  async startReceiver(): Promise<void> {
    // Check if this device is a tablet
    const deviceType = useDeviceStore.getState().deviceType;
    if (deviceType !== 'tablet') {
      console.log('[LocalPhotoReceiver] Service is only for tablet devices, current type:', deviceType);
      return;
    }

    // Check if local photo transfer is enabled
    const localPhotoTransferEnabled = useDeviceStore.getState().localPhotoTransferEnabled;
    if (!localPhotoTransferEnabled) {
      console.log('[LocalPhotoReceiver] Local photo transfer is not enabled');
      return;
    }

    if (this.status === 'running') {
      console.log('[LocalPhotoReceiver] Receiver already running');
      return;
    }

    try {
      await this.initialize();

      this.status = 'running';
      this.lastError = null;
      this.receivedCount = 0;

      const port = useDeviceStore.getState().tabletLocalPort;
      const ip = useDeviceStore.getState().tabletLocalIp;

      console.log('[LocalPhotoReceiver] Receiver started');
      console.log('[LocalPhotoReceiver] Tablet IP:', ip || 'Not configured');
      console.log('[LocalPhotoReceiver] Port:', port);
      console.log('[LocalPhotoReceiver] Ready to receive photos via processIncomingPhoto()');

      // Note: Since React Native cannot run a true HTTP server,
      // phones will need to send photos using a different mechanism:
      // 1. Via the backend server which tablets poll
      // 2. Via a native module if implemented
      // 3. Via direct function call if devices share context (not typical)
      //
      // This service provides the processing logic that can be called
      // from whichever transport mechanism is used.

    } catch (error) {
      console.error('[LocalPhotoReceiver] Failed to start receiver:', error);
      this.status = 'error';
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Stop the photo receiver
   */
  stopReceiver(): void {
    if (this.status === 'stopped') {
      console.log('[LocalPhotoReceiver] Receiver already stopped');
      return;
    }

    this.status = 'stopped';
    console.log('[LocalPhotoReceiver] Receiver stopped');
    console.log('[LocalPhotoReceiver] Total photos received this session:', this.receivedCount);
  }

  /**
   * Process an incoming photo from a phone
   * This is the main method that handles photo data regardless of transport mechanism
   *
   * @param data - The incoming photo request data
   * @returns Response indicating success or failure
   */
  async processIncomingPhoto(data: IncomingPhotoRequest): Promise<PhotoReceiverResponse> {
    console.log('[LocalPhotoReceiver] Processing incoming photo:', data.localId);

    // Validate request data
    if (!data.localId || !data.teamId || !data.eventId || !data.overlayType || !data.photoBase64) {
      const error = 'Missing required fields in photo request';
      console.error('[LocalPhotoReceiver]', error);
      return {
        success: false,
        localId: data.localId || 'unknown',
        error,
      };
    }

    // Skip on web platform
    if (Platform.OS === 'web') {
      return {
        success: false,
        localId: data.localId,
        error: 'Photo receiving not supported on web platform',
      };
    }

    try {
      // Ensure initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Define the local file path
      const localPath = `${FileSystem.documentDirectory}${LOCAL_PHOTOS_DIR}${data.localId}.jpg`;

      // Write the base64 photo data to file
      await FileSystem.writeAsStringAsync(localPath, data.photoBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('[LocalPhotoReceiver] Photo saved to:', localPath);

      // Verify the file was written
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists) {
        throw new Error('Failed to write photo file');
      }

      console.log('[LocalPhotoReceiver] Photo file size:', (fileInfo as { size?: number }).size || 'unknown');

      // Add to SQLite photo_cache table
      const db = getDatabaseSafe();
      if (db) {
        await db.addToPhotoCache({
          localId: data.localId,
          teamId: data.teamId,
          eventId: data.eventId,
          localPath,
          overlayType: data.overlayType,
        });
        console.log('[LocalPhotoReceiver] Photo added to database cache');
      } else {
        console.warn('[LocalPhotoReceiver] Database not available, skipping DB insert');
      }

      // Update the in-memory photo cache store
      const newCachedPhoto: CachedPhoto = {
        localId: data.localId,
        localPath,
        overlayType: data.overlayType,
        status: 'available',
        createdAt: new Date().toISOString(),
      };
      usePhotoCacheStore.getState().addCachedPhoto(newCachedPhoto);
      console.log('[LocalPhotoReceiver] Photo added to in-memory cache');

      // Increment received count
      this.receivedCount++;

      console.log('[LocalPhotoReceiver] Successfully processed photo:', data.localId);
      console.log('[LocalPhotoReceiver] Total photos received:', this.receivedCount);

      return {
        success: true,
        localId: data.localId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocalPhotoReceiver] Failed to process photo:', errorMessage);

      return {
        success: false,
        localId: data.localId,
        error: errorMessage,
      };
    }
  }

  /**
   * Process multiple incoming photos in batch
   *
   * @param photos - Array of incoming photo requests
   * @returns Array of responses for each photo
   */
  async processIncomingPhotos(photos: IncomingPhotoRequest[]): Promise<PhotoReceiverResponse[]> {
    console.log('[LocalPhotoReceiver] Processing batch of', photos.length, 'photos');

    const results: PhotoReceiverResponse[] = [];

    for (const photo of photos) {
      const result = await this.processIncomingPhoto(photo);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    console.log('[LocalPhotoReceiver] Batch complete:', successCount, '/', photos.length, 'successful');

    return results;
  }

  /**
   * Get the current status of the receiver
   */
  getStatus(): ReceiverStatus {
    return this.status;
  }

  /**
   * Get the number of photos received in the current session
   */
  getReceivedCount(): number {
    return this.receivedCount;
  }

  /**
   * Get the last error message if any
   */
  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Get the local photos directory path
   */
  getLocalPhotosDir(): string {
    return `${FileSystem.documentDirectory}${LOCAL_PHOTOS_DIR}`;
  }

  /**
   * Check if a photo with the given localId already exists
   */
  async photoExists(localId: string): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    const localPath = `${FileSystem.documentDirectory}${LOCAL_PHOTOS_DIR}${localId}.jpg`;
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    return fileInfo.exists;
  }

  /**
   * Delete a locally received photo
   */
  async deletePhoto(localId: string): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    try {
      const localPath = `${FileSystem.documentDirectory}${LOCAL_PHOTOS_DIR}${localId}.jpg`;
      const fileInfo = await FileSystem.getInfoAsync(localPath);

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localPath);
        console.log('[LocalPhotoReceiver] Deleted photo:', localId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[LocalPhotoReceiver] Failed to delete photo:', error);
      return false;
    }
  }

  /**
   * Clear all locally received photos
   */
  async clearAllPhotos(): Promise<number> {
    if (Platform.OS === 'web') {
      return 0;
    }

    try {
      const dirPath = `${FileSystem.documentDirectory}${LOCAL_PHOTOS_DIR}`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        return 0;
      }

      const files = await FileSystem.readDirectoryAsync(dirPath);
      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith('.jpg')) {
          await FileSystem.deleteAsync(`${dirPath}${file}`);
          deletedCount++;
        }
      }

      console.log('[LocalPhotoReceiver] Cleared', deletedCount, 'photos');
      return deletedCount;
    } catch (error) {
      console.error('[LocalPhotoReceiver] Failed to clear photos:', error);
      return 0;
    }
  }

  /**
   * Get info about all locally stored photos
   */
  async getStoredPhotos(): Promise<{ localId: string; path: string; size: number }[]> {
    if (Platform.OS === 'web') {
      return [];
    }

    try {
      const dirPath = `${FileSystem.documentDirectory}${LOCAL_PHOTOS_DIR}`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(dirPath);
      const photos: { localId: string; path: string; size: number }[] = [];

      for (const file of files) {
        if (file.endsWith('.jpg')) {
          const filePath = `${dirPath}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists) {
            photos.push({
              localId: file.replace('.jpg', ''),
              path: filePath,
              size: (fileInfo as { size?: number }).size || 0,
            });
          }
        }
      }

      return photos;
    } catch (error) {
      console.error('[LocalPhotoReceiver] Failed to get stored photos:', error);
      return [];
    }
  }

  /**
   * Cleanup the service
   */
  cleanup(): void {
    this.stopReceiver();
    this.isInitialized = false;
    console.log('[LocalPhotoReceiver] Cleanup complete');
  }
}

// Singleton instance
let localPhotoReceiverInstance: LocalPhotoReceiverService | null = null;

/**
 * Get the LocalPhotoReceiverService singleton instance
 */
export function getLocalPhotoReceiverService(): LocalPhotoReceiverService {
  if (!localPhotoReceiverInstance) {
    localPhotoReceiverInstance = new LocalPhotoReceiverService();
  }
  return localPhotoReceiverInstance;
}

/**
 * Initialize and start the local photo receiver service
 */
export async function initializeLocalPhotoReceiver(): Promise<LocalPhotoReceiverService> {
  const service = getLocalPhotoReceiverService();
  await service.startReceiver();
  return service;
}

/**
 * Cleanup the local photo receiver service
 */
export function cleanupLocalPhotoReceiver(): void {
  if (localPhotoReceiverInstance) {
    localPhotoReceiverInstance.cleanup();
    localPhotoReceiverInstance = null;
  }
}

export { LocalPhotoReceiverService };
