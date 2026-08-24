// SyncProvider - manages sync service lifecycle and provides sync context
import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import {
  getSyncService,
  initializeSyncService,
  cleanupSyncService,
} from '@/lib/services/sync-service';
import {
  initializeLocalPhotoSender,
  cleanupLocalPhotoSender,
} from '@/lib/services/local-photo-sender';
import { useSyncStore } from '@/lib/state/sync-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { cacheEventOverlay } from '@/lib/overlays/overlay-cache';
import { useDatabaseReady } from '@/providers/DatabaseProvider';
import type { SyncResult } from '@/lib/services/sync-types';

interface SyncContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  sync: () => Promise<SyncResult>;
  downloadPhotos: (teamId: string, eventId: string) => Promise<number>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

interface SyncProviderProps {
  children: React.ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const isInitialized = useRef(false);
  const isDatabaseReady = useDatabaseReady();

  // Subscribe to device store state
  const deviceType = useDeviceStore((s) => s.deviceType);
  const currentEventId = useDeviceStore((s) => s.currentEventId);

  // Subscribe to sync store state
  const isOnline = useSyncStore((s) => s.isOnline);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const pendingSurveys = useSyncStore((s) => s.pendingSurveys);
  const pendingPledges = useSyncStore((s) => s.pendingPledges);
  const pendingPhotos = useSyncStore((s) => s.pendingPhotos);

  const pendingCount = pendingSurveys + pendingPledges + pendingPhotos;

  // Initialize sync service when database is ready
  useEffect(() => {
    if (!isDatabaseReady) {
      console.log('[SyncProvider] Waiting for database to be ready...');
      return;
    }

    if (isInitialized.current) return;
    isInitialized.current = true;

    console.log('[SyncProvider] Database ready, initializing sync service');
    initializeSyncService();

    return () => {
      console.log('[SyncProvider] Cleaning up sync service');
      cleanupSyncService();
      isInitialized.current = false;
    };
  }, [isDatabaseReady]);

  // Phones push each photo to the server as soon as it's taken, so the kiosk
  // tablets can show it seconds later. Tablets just read from the server, so
  // they don't need a sender.
  useEffect(() => {
    if (!isDatabaseReady || deviceType !== 'phone') {
      return;
    }

    console.log('[SyncProvider] Starting photo sender');
    initializeLocalPhotoSender();

    return () => {
      console.log('[SyncProvider] Stopping photo sender');
      cleanupLocalPhotoSender();
    };
  }, [isDatabaseReady, deviceType]);

  // Keep the current event's overlay artwork on the device.
  //
  // Runs whenever the app has an event and a connection — including the moment
  // a connection comes back — so a device set up in the office arrives at the
  // venue already holding its frame. Re-downloading is skipped when the same
  // file is already stored, so this is cheap to repeat; the point of repeating
  // it is that swapping an event's artwork in the admin portal reaches the
  // phones without anyone re-picking the event.
  useEffect(() => {
    if (!isOnline || !currentEventId || currentEventId === 'no-event') return;

    cacheEventOverlay(currentEventId).catch((err: unknown) => {
      console.log('[SyncProvider] Overlay download failed, will retry:', err);
    });
  }, [isOnline, currentEventId]);

  // Manual sync trigger
  const sync = useCallback(async (): Promise<SyncResult> => {
    const service = getSyncService();
    return service.forceSync();
  }, []);

  // Download photos for tablet
  const downloadPhotos = useCallback(
    async (teamId: string, eventId: string): Promise<number> => {
      const service = getSyncService();
      return service.downloadTeamPhotos(teamId, eventId);
    },
    []
  );

  const value: SyncContextValue = {
    isOnline,
    isSyncing,
    lastSyncAt,
    pendingCount,
    sync,
    downloadPhotos,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/**
 * Hook to access sync context
 */
export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

/**
 * Hook to get just the online status (optimized selector)
 */
export function useSyncOnlineStatus(): boolean {
  const context = useContext(SyncContext);
  return context?.isOnline ?? false;
}

/**
 * Hook to get just the syncing status (optimized selector)
 */
export function useSyncingStatus(): boolean {
  const context = useContext(SyncContext);
  return context?.isSyncing ?? false;
}

/**
 * Hook to get just the pending count (optimized selector)
 */
export function useSyncPendingCount(): number {
  const context = useContext(SyncContext);
  return context?.pendingCount ?? 0;
}
