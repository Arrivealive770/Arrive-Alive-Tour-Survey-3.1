// Sync service for offline-first data synchronization
// Handles automatic syncing when connectivity is restored

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { getDatabase, isDatabaseInitialized, getDatabaseSafe } from '@/lib/db/database';
import { useSyncStore } from '@/lib/state/sync-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { usePhotoCacheStore, type CachedPhoto } from '@/lib/state/photo-cache-store';
import type {
  SyncResult,
  SyncBatchResponse,
  PhotoUploadResponse,
  PhotoListResponse,
  RemotePhotoMetadata,
  SyncItemType,
  RetryConfig,
} from './sync-types';
import { DEFAULT_RETRY_CONFIG } from './sync-types';

const BATCH_SIZE = 50;
const PHOTO_BATCH_SIZE = 10;
// How often to poll the backend for photos that were deleted elsewhere so we
// can remove the matching local files from this phone / tablet.
const DELETION_POLL_INTERVAL_MS = 20000;
// How often to retry anything still waiting on this device (photos taken while
// the signal was down, surveys, pledges). Without this a photo could sit in the
// phone's queue until the app was backgrounded and reopened.
const PENDING_SYNC_INTERVAL_MS = 15000;

class SyncService {
  private syncInProgress = false;
  private retryTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private netInfoUnsubscribe: (() => void) | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private deletionPollTimer: ReturnType<typeof setInterval> | null = null;
  private pendingSyncTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
  }

  /**
   * Initialize the sync service
   * Sets up network monitoring and app state listeners
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('[SyncService] Already initialized');
      return;
    }

    console.log('[SyncService] Initializing...');

    // Subscribe to network state changes
    this.netInfoUnsubscribe = NetInfo.addEventListener(this.handleNetworkChange);

    // Subscribe to app state changes (foreground/background)
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );

    // Check initial connectivity
    this.checkConnectivity().then((isOnline) => {
      useSyncStore.getState().setOnlineStatus(isOnline);
      if (isOnline && isDatabaseInitialized()) {
        // Trigger initial sync on startup if online and DB ready
        this.syncAll();
      }
    });

    // Update pending counts only if DB is initialized
    if (isDatabaseInitialized()) {
      this.updatePendingCounts();
    }

    // Start polling for remote deletions so finished/purged photos are cleaned
    // off this device (phone photo_queue + tablet photo_cache).
    this.startDeletionPolling();

    // Keep retrying anything still queued on this device so photos reach the
    // tablets without anyone having to press anything.
    this.startPendingSyncPolling();

    this.isInitialized = true;
    console.log('[SyncService] Initialized successfully');
  }

  /**
   * Handle network state changes
   */
  private handleNetworkChange = (state: NetInfoState): void => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;

    console.log('[SyncService] Network state changed:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      isOnline,
    });

    const previousOnline = useSyncStore.getState().isOnline;
    useSyncStore.getState().setOnlineStatus(isOnline);

    // If we just came online, trigger sync
    if (isOnline && !previousOnline) {
      console.log('[SyncService] Connection restored, triggering sync');
      this.syncAll();
    }
  };

  /**
   * Handle app state changes (foreground/background)
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    console.log('[SyncService] App state changed:', nextAppState);

    if (nextAppState === 'active') {
      // App came to foreground
      this.checkConnectivity().then((isOnline) => {
        if (isOnline) {
          this.syncAll();
        }
      });
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background - cancel any pending retries
      this.cancelAllRetries();
    }
  };

  /**
   * Check current network connectivity
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      useSyncStore.getState().setOnlineStatus(isOnline);
      return isOnline;
    } catch (error) {
      console.error('[SyncService] Error checking connectivity:', error);
      return false;
    }
  }

  /**
   * Main sync function - syncs all pending items
   */
  async syncAll(): Promise<SyncResult> {
    // Check if database is initialized first
    if (!isDatabaseInitialized()) {
      console.log('[SyncService] Database not initialized, skipping sync');
      return { status: 'skipped' };
    }

    // Prevent concurrent syncs
    if (this.syncInProgress) {
      console.log('[SyncService] Sync already in progress, skipping');
      return { status: 'skipped' };
    }

    // Check connectivity first
    const isOnline = await this.checkConnectivity();
    if (!isOnline) {
      console.log('[SyncService] Offline, skipping sync');
      return { status: 'skipped' };
    }

    this.syncInProgress = true;
    useSyncStore.getState().setSyncing(true);

    console.log('[SyncService] Starting sync...');

    try {
      // Sync surveys, pledges, and photos; also propagate remote deletions.
      const [surveyResult, pledgeResult, photoResult] = await Promise.all([
        this.syncSurveys(),
        this.syncPledges(),
        this.syncPhotos(),
        this.syncDeletions(),
      ]);

      // Phone-side cleanup runs after uploads so freshly-uploaded originals can
      // be dropped once tablets have received them.
      await this.syncPhoneCleanup();

      // Update sync timestamp
      useSyncStore.getState().setLastSyncAt(new Date().toISOString());

      // Update pending counts
      await this.updatePendingCounts();

      // Determine overall status
      const totalFailed =
        surveyResult.failed + pledgeResult.failed + photoResult.failed;
      const totalSynced =
        surveyResult.synced + pledgeResult.synced + photoResult.synced;

      let status: SyncResult['status'] = 'success';
      if (totalFailed > 0 && totalSynced > 0) {
        status = 'partial';
      } else if (totalFailed > 0 && totalSynced === 0) {
        status = 'error';
      }

      console.log('[SyncService] Sync completed:', {
        status,
        surveys: surveyResult,
        pledges: pledgeResult,
        photos: photoResult,
      });

      return {
        status,
        surveys: surveyResult,
        pledges: pledgeResult,
        photos: photoResult,
      };
    } catch (error) {
      console.error('[SyncService] Sync failed:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.syncInProgress = false;
      useSyncStore.getState().setSyncing(false);
    }
  }

  /**
   * Sync pending surveys to the server
   */
  async syncSurveys(): Promise<{ synced: number; failed: number }> {
    const db = getDatabaseSafe();
    if (!db) {
      console.log('[SyncService] Database not ready, skipping survey sync');
      return { synced: 0, failed: 0 };
    }
    const deviceId = useDeviceStore.getState().deviceId || 'unknown';
    const teamId = useDeviceStore.getState().teamId || 'unknown';

    let totalSynced = 0;
    let totalFailed = 0;

    try {
      // Get pending surveys
      const allPending = await db.getPendingSurveys(BATCH_SIZE);

      // The server rejects unknown event/team ids with a foreign-key error, so
      // sending them just retries forever. Fill in the ids this device knows
      // about; anything still unresolved is failed once, not looped on.
      const currentEventId = useDeviceStore.getState().currentEventId;
      const pendingSurveys = [];
      for (const survey of allPending) {
        const resolvedEventId =
          survey.eventId && survey.eventId !== 'unknown' ? survey.eventId : currentEventId;
        const resolvedTeamId =
          survey.teamId && survey.teamId !== 'unknown' ? survey.teamId : teamId;

        if (!resolvedEventId || resolvedEventId === 'unknown' || resolvedTeamId === 'unknown') {
          console.warn(`[SyncService] Survey ${survey.localId} has no valid event - not syncable`);
          await db.markSurveyFailed(survey.localId, 'No event selected when this survey was taken');
          useSyncStore.getState().addError({
            type: 'survey',
            localId: survey.localId,
            message: 'No event selected when this survey was taken',
          });
          totalFailed++;
          continue;
        }

        pendingSurveys.push({ ...survey, eventId: resolvedEventId, teamId: resolvedTeamId });
      }

      if (pendingSurveys.length === 0) {
        console.log('[SyncService] No pending surveys to sync');
        return { synced: 0, failed: totalFailed };
      }

      console.log(`[SyncService] Syncing ${pendingSurveys.length} surveys`);

      // Mark as syncing
      const localIds = pendingSurveys.map((s) => s.localId);
      await db.markSurveysSyncing(localIds);

      // Send batch to server
      const response = await fetch(`${this.baseUrl}/api/sync/surveys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveys: pendingSurveys.map((s) => ({
            localId: s.localId,
            teamId: s.teamId,
            eventId: s.eventId,
            surveyTypeSlug: s.surveyTypeSlug,
            responses: s.responses,
            ageRange: s.ageRange,
            deviceId: s.deviceId,
            completedAt: s.completedAt,
            durationSeconds: s.durationSeconds,
          })),
          deviceId,
          teamId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = (await response.json()) as { data: SyncBatchResponse };
      const data = result.data;

      // Mark synced items
      if (data.synced.length > 0) {
        await db.markSurveysSynced(data.synced);
        totalSynced = data.synced.length;
      }

      // Handle failures
      for (const failure of data.errors) {
        await db.markSurveyFailed(failure.localId, failure.error);
        totalFailed++;

        // Add to sync errors
        useSyncStore.getState().addError({
          type: 'survey',
          localId: failure.localId,
          message: failure.error,
        });
      }

      // Schedule retry for failed items if under max attempts
      if (totalFailed > 0) {
        const failedSurvey = pendingSurveys.find(
          (s) => data.errors.some((f) => f.localId === s.localId)
        );
        if (failedSurvey && failedSurvey.syncAttempts < DEFAULT_RETRY_CONFIG.maxAttempts) {
          const delay = this.calculateRetryDelay(failedSurvey.syncAttempts);
          this.scheduleRetry('surveys', delay);
        }
      }
    } catch (error) {
      console.error('[SyncService] Survey sync error:', error);
      // Mark all as failed
      const pendingSurveys = await db.getPendingSurveys(BATCH_SIZE);
      for (const survey of pendingSurveys) {
        await db.markSurveyFailed(
          survey.localId,
          error instanceof Error ? error.message : 'Unknown error'
        );
        totalFailed++;
      }

      // Schedule retry
      this.scheduleRetry('surveys', DEFAULT_RETRY_CONFIG.baseDelayMs);
    }

    return { synced: totalSynced, failed: totalFailed };
  }

  /**
   * Sync pending pledges to the server
   */
  async syncPledges(): Promise<{ synced: number; failed: number }> {
    const db = getDatabaseSafe();
    if (!db) {
      console.log('[SyncService] Database not ready, skipping pledge sync');
      return { synced: 0, failed: 0 };
    }
    const deviceId = useDeviceStore.getState().deviceId || 'unknown';
    const teamId = useDeviceStore.getState().teamId || 'unknown';

    let totalSynced = 0;
    let totalFailed = 0;

    try {
      // Get pending pledges
      const pendingPledges = await db.getPendingPledges(BATCH_SIZE);

      if (pendingPledges.length === 0) {
        console.log('[SyncService] No pending pledges to sync');
        return { synced: 0, failed: 0 };
      }

      console.log(`[SyncService] Syncing ${pendingPledges.length} pledges`);

      // Send batch to server
      const response = await fetch(`${this.baseUrl}/api/sync/pledges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pledges: pendingPledges.map((p) => ({
            localId: p.localId,
            surveyLocalId: p.surveyLocalId,
            teamId: p.teamId,
            eventId: p.eventId,
            email: p.email,
            photoLocalId: p.photoLocalId,
            photoId: p.photoId,
            compositedPhotoUrl: p.compositedPhotoUrl,
            createdAt: p.createdAt,
          })),
          deviceId,
          teamId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = (await response.json()) as { data: SyncBatchResponse };
      const data = result.data;

      // Mark synced items
      if (data.synced.length > 0) {
        await db.markPledgesSynced(data.synced);
        totalSynced = data.synced.length;
      }

      // Handle failures
      for (const failure of data.errors) {
        await db.markPledgeFailed(failure.localId, failure.error);
        totalFailed++;

        // Add to sync errors
        useSyncStore.getState().addError({
          type: 'pledge',
          localId: failure.localId,
          message: failure.error,
        });
      }

      // Schedule retry for failed items
      if (totalFailed > 0) {
        const failedPledge = pendingPledges.find(
          (p) => data.errors.some((f) => f.localId === p.localId)
        );
        if (failedPledge && failedPledge.syncAttempts < DEFAULT_RETRY_CONFIG.maxAttempts) {
          const delay = this.calculateRetryDelay(failedPledge.syncAttempts);
          this.scheduleRetry('pledges', delay);
        }
      }
    } catch (error) {
      console.error('[SyncService] Pledge sync error:', error);
      // Mark all as failed
      const pendingPledges = await db.getPendingPledges(BATCH_SIZE);
      for (const pledge of pendingPledges) {
        await db.markPledgeFailed(
          pledge.localId,
          error instanceof Error ? error.message : 'Unknown error'
        );
        totalFailed++;
      }

      // Schedule retry
      this.scheduleRetry('pledges', DEFAULT_RETRY_CONFIG.baseDelayMs);
    }

    return { synced: totalSynced, failed: totalFailed };
  }

  /**
   * Sync pending photos to the server (Phone -> Cloud)
   */
  async syncPhotos(): Promise<{ synced: number; failed: number }> {
    const db = getDatabaseSafe();
    if (!db) {
      console.log('[SyncService] Database not ready, skipping photo sync');
      return { synced: 0, failed: 0 };
    }
    const teamId = useDeviceStore.getState().teamId || 'unknown';
    const eventId = useDeviceStore.getState().currentEventId || 'unknown';
    const deviceId = useDeviceStore.getState().deviceId; // capturing phone

    let totalSynced = 0;
    let totalFailed = 0;

    try {
      // Get pending photos
      const pendingPhotos = await db.getPendingPhotos(PHOTO_BATCH_SIZE);

      if (pendingPhotos.length === 0) {
        console.log('[SyncService] No pending photos to sync');
        return { synced: 0, failed: 0 };
      }

      console.log(`[SyncService] Syncing ${pendingPhotos.length} photos`);

      // Process photos one at a time due to FormData requirements
      for (const photo of pendingPhotos) {
        try {
          // Skip photos with invalid event IDs - mark as failed permanently
          const photoEventId = photo.eventId || eventId;
          if (!photoEventId || photoEventId === 'no-event' || photoEventId === 'unknown') {
            console.log(`[SyncService] Skipping photo ${photo.localId} - no valid event ID`);
            await db.markPhotoUploadFailed(photo.localId);
            // Mark as permanently failed by setting attempts to max
            totalFailed++;
            useSyncStore.getState().addError({
              type: 'photo',
              localId: photo.localId,
              message: 'No valid event ID - photo cannot be synced',
            });
            continue;
          }

          // Mark as uploading
          await db.markPhotoUploading(photo.localId);

          // Check if file exists (skip on web since FileSystem.getInfoAsync is not available)
          if (Platform.OS !== 'web') {
            const fileInfo = await FileSystem.getInfoAsync(photo.localPath);
            if (!fileInfo.exists) {
              throw new Error('Photo file not found');
            }
          }

          // Create FormData for upload
          const formData = new FormData();
          formData.append('file', {
            uri: photo.localPath,
            type: 'image/jpeg',
            name: `${photo.localId}.jpg`,
          } as unknown as Blob);
          formData.append('localId', photo.localId);
          formData.append('teamId', photo.teamId || teamId);
          formData.append('eventId', photoEventId);
          formData.append('overlayType', photo.overlayType);
          // Tell the backend which phone captured this so it can gate
          // phone-side original cleanup (captureDeviceId).
          if (deviceId) {
            formData.append('deviceId', deviceId);
          }

          // Upload to server
          const response = await fetch(`${this.baseUrl}/api/photos/upload`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
          }

          const result = (await response.json()) as { data: PhotoUploadResponse };
          const data = result.data;

          if (data.success) {
            await db.markPhotoUploaded(photo.localId, data.remoteUrl);
            totalSynced++;
          } else {
            throw new Error('Upload response indicated failure');
          }
        } catch (error) {
          console.error(`[SyncService] Photo upload error for ${photo.localId}:`, error);
          await db.markPhotoUploadFailed(photo.localId);
          totalFailed++;

          // Add to sync errors
          useSyncStore.getState().addError({
            type: 'photo',
            localId: photo.localId,
            message: error instanceof Error ? error.message : 'Unknown error',
          });

          // Schedule retry if under max attempts
          if (photo.uploadAttempts < DEFAULT_RETRY_CONFIG.maxAttempts) {
            const delay = this.calculateRetryDelay(photo.uploadAttempts);
            this.scheduleRetry('photos', delay);
          }
        }
      }
    } catch (error) {
      console.error('[SyncService] Photo sync error:', error);
    }

    return { synced: totalSynced, failed: totalFailed };
  }

  /**
   * Download team photos from cloud to tablet cache
   */
  async downloadTeamPhotos(teamId: string, eventId: string): Promise<number> {
    const db = getDatabaseSafe();
    if (!db) {
      console.log('[SyncService] Database not ready, skipping photo download');
      return 0;
    }

    // Skip on web since FileSystem APIs are not available
    if (Platform.OS === 'web') {
      console.log('[SyncService] Photo download not supported on web');
      return 0;
    }

    let downloaded = 0;

    try {
      console.log(`[SyncService] Fetching photos for team ${teamId}, event ${eventId}`);

      // Get list of photos from server
      const response = await fetch(
        `${this.baseUrl}/api/sync/photos/${teamId}/${eventId}`
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // The backend returns full Photo fields (id, localId, storageUrl, ...).
      // Support the legacy { photos: [{ remoteUrl }] } shape as a fallback.
      const parsed = (await response.json()) as {
        data:
          | PhotoListResponse
          | Array<{
              id: string;
              localId: string;
              storageUrl: string | null;
              overlayType: string;
              createdAt: string;
            }>;
      };
      const remotePhotos = Array.isArray(parsed.data)
        ? parsed.data.map((p) => ({
            id: p.id,
            localId: p.localId,
            remoteUrl: p.storageUrl ?? '',
            overlayType: p.overlayType,
            createdAt: p.createdAt,
          }))
        : parsed.data.photos.map((p) => ({
            id: (p as RemotePhotoMetadata & { id?: string }).id ?? '',
            localId: p.localId,
            remoteUrl: p.remoteUrl,
            overlayType: p.overlayType,
            createdAt: p.createdAt,
          }));

      console.log(`[SyncService] Found ${remotePhotos.length} remote photos`);

      const tabletDeviceId = useDeviceStore.getState().deviceId;

      // Get existing cached photo IDs
      const existingPhotos = await db.getAvailablePhotos(teamId, eventId, 1000);
      const existingIds = new Set(existingPhotos.map((p) => p.localId));

      // Download new photos
      for (const remotePhoto of remotePhotos) {
        if (existingIds.has(remotePhoto.localId)) {
          continue; // Already cached
        }
        if (!remotePhoto.remoteUrl) {
          continue; // No source url to download from
        }

        try {
          // Download the photo
          const localPath = `${FileSystem.documentDirectory}photo_cache/${remotePhoto.localId}.jpg`;

          // Ensure directory exists
          await FileSystem.makeDirectoryAsync(
            `${FileSystem.documentDirectory}photo_cache/`,
            { intermediates: true }
          );

          // Download file
          const downloadResult = await FileSystem.downloadAsync(
            remotePhoto.remoteUrl,
            localPath
          );

          if (downloadResult.status === 200) {
            // Add to database
            await db.addToPhotoCache({
              localId: remotePhoto.localId,
              teamId,
              eventId,
              localPath,
              overlayType: remotePhoto.overlayType,
            });

            // Add to in-memory cache
            const newCachedPhoto: CachedPhoto = {
              localId: remotePhoto.localId,
              localPath,
              overlayType: remotePhoto.overlayType,
              status: 'available',
              createdAt: remotePhoto.createdAt,
            };
            usePhotoCacheStore.getState().addCachedPhoto(newCachedPhoto);

            downloaded++;

            // Acknowledge receipt so the capturing phone can drop its original.
            // Idempotent server-side; photo stays "available" for tablets.
            if (remotePhoto.id && tabletDeviceId) {
              try {
                await fetch(`${this.baseUrl}/api/photos/${remotePhoto.id}/received`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ deviceId: tabletDeviceId }),
                });
              } catch (ackError) {
                console.error(
                  `[SyncService] Failed to ack receipt for ${remotePhoto.localId}:`,
                  ackError
                );
              }
            }
          }
        } catch (downloadError) {
          console.error(
            `[SyncService] Failed to download photo ${remotePhoto.localId}:`,
            downloadError
          );
        }
      }

      console.log(`[SyncService] Downloaded ${downloaded} new photos`);
    } catch (error) {
      console.error('[SyncService] Photo download error:', error);
    }

    return downloaded;
  }

  /**
   * Start the periodic deletion poll. When a photo is finished (sent -> deleted)
   * or an event is purged, the backend marks photos "deleted". Every device
   * polls for those and removes the matching local files + rows so they never
   * render again on the phone or either tablet.
   */
  private startDeletionPolling(): void {
    if (this.deletionPollTimer) return;

    const poll = () => {
      // Full-removal propagation (sent / purge) for every device.
      this.syncDeletions().catch((e) =>
        console.error('[SyncService] Deletion poll failed:', e)
      );
      // Phone-only: drop local originals already received by all tablets.
      this.syncPhoneCleanup().catch((e) =>
        console.error('[SyncService] Phone-cleanup poll failed:', e)
      );
    };

    // Run once immediately, then on an interval.
    poll();
    this.deletionPollTimer = setInterval(poll, DELETION_POLL_INTERVAL_MS);
  }

  /**
   * Periodically push anything still waiting on this device. A phone at a busy
   * event can take photos faster than a flaky venue wifi uploads them, and the
   * kiosk tablets can only show a photo once it has landed on the server, so we
   * keep trying on a timer rather than only on app-foreground / network-change.
   *
   * Cheap when idle: it reads the local SQLite counts first and does nothing at
   * all when there's no backlog.
   */
  private startPendingSyncPolling(): void {
    if (this.pendingSyncTimer) return;

    const tick = async () => {
      try {
        if (this.syncInProgress) return;

        const db = getDatabaseSafe();
        if (!db) return;

        const [surveyCount, pledgeCount, photoCount] = await Promise.all([
          db.getSurveyQueueCount(),
          db.getPledgeQueueCount(),
          db.getPhotoQueueCount(),
        ]);

        const pending = surveyCount.pending + surveyCount.failed + pledgeCount + photoCount;
        if (pending === 0) return;

        console.log(`[SyncService] ${pending} item(s) still queued, syncing`);
        await this.syncAll();
      } catch (error) {
        console.error('[SyncService] Pending-sync poll failed:', error);
      }
    };

    this.pendingSyncTimer = setInterval(tick, PENDING_SYNC_INTERVAL_MS);
  }

  /**
   * PHONE ONLY. Poll for this phone's captured originals that all active tablets
   * have now received. For each, delete the local original file + its
   * photo_queue row, then confirm via PUT /phone-deleted so it stops being
   * returned. The backend Photo stays "available" (tablets keep showing it).
   *
   * This is SEPARATE from syncDeletions (which handles full removal after a
   * send or a post-event purge). They operate on disjoint photo sets.
   */
  async syncPhoneCleanup(): Promise<number> {
    const db = getDatabaseSafe();
    if (!db) return 0;
    if (Platform.OS === 'web') return 0;

    const deviceType = useDeviceStore.getState().deviceType;
    if (deviceType !== 'phone') return 0; // Only the capturing phone cleans up.

    const teamId = useDeviceStore.getState().teamId;
    const eventId = useDeviceStore.getState().currentEventId;
    const deviceId = useDeviceStore.getState().deviceId;
    if (!teamId || !eventId || !deviceId) return 0;

    if (!useSyncStore.getState().isOnline) return 0;

    let removed = 0;

    try {
      const response = await fetch(
        `${this.baseUrl}/api/photos/phone-cleanup/${teamId}/${eventId}?deviceId=${encodeURIComponent(
          deviceId
        )}`
      );
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = (await response.json()) as {
        data: { deletable: Array<{ id: string; localId: string; storageKey: string | null }> };
      };
      const deletable = result.data?.deletable ?? [];
      if (deletable.length === 0) return 0;

      const localIds = deletable.map((d) => d.localId);
      const queued = await db.getPhotoQueueByLocalIds(localIds);
      const queuedByLocalId = new Map(queued.map((q) => [q.localId, q]));

      for (const entry of deletable) {
        try {
          // Delete the phone's local original file (best-effort).
          const row = queuedByLocalId.get(entry.localId);
          if (row) {
            await this.deleteLocalFile(row.localPath);
            await db.deletePhotoQueueByLocalIds([entry.localId]);
          }

          // Confirm so the backend stops returning it (phoneOriginalDeleted=true).
          await fetch(`${this.baseUrl}/api/photos/${entry.id}/phone-deleted`, {
            method: 'PUT',
          });

          removed++;
        } catch (entryError) {
          console.error(
            `[SyncService] Phone-cleanup failed for ${entry.localId}:`,
            entryError
          );
        }
      }

      if (removed > 0) {
        console.log(`[SyncService] Phone-cleanup dropped ${removed} local originals`);
        await this.updatePendingCounts();
      }
    } catch (error) {
      console.error('[SyncService] Phone-cleanup error:', error);
    }

    return removed;
  }

  /**
   * Poll the backend for photos deleted elsewhere and remove their local
   * copies from this device. Matches by localId (and storageKey for logging).
   */
  async syncDeletions(): Promise<number> {
    const db = getDatabaseSafe();
    if (!db) return 0;

    const teamId = useDeviceStore.getState().teamId;
    const eventId = useDeviceStore.getState().currentEventId;
    if (!teamId || !eventId) return 0;

    const isOnline = useSyncStore.getState().isOnline;
    if (!isOnline) return 0;

    let removed = 0;

    try {
      const response = await fetch(
        `${this.baseUrl}/api/photos/deleted/${teamId}/${eventId}`
      );
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = (await response.json()) as {
        data: { deleted: Array<{ localId: string; storageKey: string | null }> };
      };
      const deleted = result.data?.deleted ?? [];
      if (deleted.length === 0) return 0;

      const localIds = deleted.map((d) => d.localId);

      // 1. Remove tablet photo_cache files + rows.
      const cached = await db.getPhotoCacheByLocalIds(localIds);
      for (const item of cached) {
        await this.deleteLocalFile(item.localPath);
      }
      if (cached.length > 0) {
        await db.deletePhotoCacheByLocalIds(cached.map((c) => c.localId));
        // Remove from in-memory tablet cache so they stop rendering.
        const removedIds = new Set(cached.map((c) => c.localId));
        const remaining = usePhotoCacheStore
          .getState()
          .cachedPhotos.filter((p) => !removedIds.has(p.localId));
        usePhotoCacheStore.getState().setCachedPhotos(remaining);
        removed += cached.length;
      }

      // 2. Remove phone photo_queue files + rows.
      const queued = await db.getPhotoQueueByLocalIds(localIds);
      for (const item of queued) {
        await this.deleteLocalFile(item.localPath);
      }
      if (queued.length > 0) {
        await db.deletePhotoQueueByLocalIds(queued.map((q) => q.localId));
        removed += queued.length;
      }

      if (removed > 0) {
        console.log(`[SyncService] Deletion poll removed ${removed} local photos`);
        await this.updatePendingCounts();
      }
    } catch (error) {
      console.error('[SyncService] Deletion sync error:', error);
    }

    return removed;
  }

  /** Best-effort delete of a local file (no-op on web / missing file). */
  private async deleteLocalFile(path: string | null | undefined): Promise<void> {
    if (!path || Platform.OS === 'web') return;
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true });
      }
    } catch (error) {
      console.error('[SyncService] Failed to delete local file:', path, error);
    }
  }

  /**
   * Schedule a retry for failed sync operations
   */
  scheduleRetry(type: SyncItemType, delayMs: number): void {
    // Clear any existing retry for this type
    const existingTimeout = this.retryTimeouts.get(type);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    console.log(`[SyncService] Scheduling ${type} retry in ${delayMs}ms`);

    const timeout = setTimeout(async () => {
      this.retryTimeouts.delete(type);

      // Check connectivity before retrying
      const isOnline = await this.checkConnectivity();
      if (!isOnline) {
        console.log(`[SyncService] Still offline, skipping ${type} retry`);
        return;
      }

      console.log(`[SyncService] Executing ${type} retry`);

      switch (type) {
        case 'surveys':
          await this.syncSurveys();
          break;
        case 'pledges':
          await this.syncPledges();
          break;
        case 'photos':
          await this.syncPhotos();
          break;
      }

      // Update counts after retry
      await this.updatePendingCounts();
    }, delayMs);

    this.retryTimeouts.set(type, timeout);
  }

  /**
   * Calculate retry delay based on attempt number
   * Exponential backoff: 5s, 15s, 45s
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
    return config.baseDelayMs * Math.pow(config.multiplier, attempt);
  }

  /**
   * Cancel all pending retry timeouts
   */
  private cancelAllRetries(): void {
    for (const [type, timeout] of this.retryTimeouts) {
      clearTimeout(timeout);
      console.log(`[SyncService] Cancelled ${type} retry`);
    }
    this.retryTimeouts.clear();
  }

  /**
   * Update pending counts in the sync store
   */
  private async updatePendingCounts(): Promise<void> {
    try {
      const db = getDatabaseSafe();
      if (!db) {
        console.log('[SyncService] Database not ready, skipping count update');
        return;
      }

      const [surveyCount, pledgeCount, photoCount] = await Promise.all([
        db.getSurveyQueueCount(),
        db.getPledgeQueueCount(),
        db.getPhotoQueueCount(),
      ]);

      useSyncStore.getState().updateCounts({
        pendingSurveys: surveyCount.pending + surveyCount.failed,
        pendingPledges: pledgeCount,
        pendingPhotos: photoCount,
      });
    } catch (error) {
      console.error('[SyncService] Error updating pending counts:', error);
    }
  }

  /**
   * Force a manual sync
   */
  async forceSync(): Promise<SyncResult> {
    console.log('[SyncService] Force sync requested');
    return this.syncAll();
  }

  /**
   * Cleanup the sync service
   */
  cleanup(): void {
    console.log('[SyncService] Cleaning up...');

    // Cancel all retries
    this.cancelAllRetries();

    // Stop deletion polling
    if (this.deletionPollTimer) {
      clearInterval(this.deletionPollTimer);
      this.deletionPollTimer = null;
    }

    // Stop pending-work polling
    if (this.pendingSyncTimer) {
      clearInterval(this.pendingSyncTimer);
      this.pendingSyncTimer = null;
    }

    // Unsubscribe from network info
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    // Unsubscribe from app state
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.isInitialized = false;
    console.log('[SyncService] Cleanup complete');
  }
}

// Singleton instance
let syncServiceInstance: SyncService | null = null;

export function getSyncService(): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService();
  }
  return syncServiceInstance;
}

export function initializeSyncService(): SyncService {
  const service = getSyncService();
  service.initialize();
  return service;
}

export function cleanupSyncService(): void {
  if (syncServiceInstance) {
    syncServiceInstance.cleanup();
    syncServiceInstance = null;
  }
}

export { SyncService };
