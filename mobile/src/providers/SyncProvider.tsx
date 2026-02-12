// SyncProvider - manages sync service lifecycle and provides sync context
import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import {
  getSyncService,
  initializeSyncService,
  cleanupSyncService,
} from '@/lib/services/sync-service';
import {
  initializeLocalPhotoReceiver,
  cleanupLocalPhotoReceiver,
} from '@/lib/services/local-photo-receiver';
import {
  initializeLocalPhotoSender,
  cleanupLocalPhotoSender,
} from '@/lib/services/local-photo-sender';
import { useSyncStore } from '@/lib/state/sync-store';
import { useDeviceStore } from '@/lib/state/device-store';
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
  const localPhotoTransferEnabled = useDeviceStore((s) => s.localPhotoTransferEnabled);

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

  // Initialize local photo transfer services based on device type
  useEffect(() => {
    if (!isDatabaseReady || !localPhotoTransferEnabled) {
      return;
    }

    console.log('[SyncProvider] Initializing local photo transfer services');

    if (deviceType === 'tablet') {
      // Tablet receives photos
      initializeLocalPhotoReceiver();
    } else if (deviceType === 'phone') {
      // Phone sends photos
      initializeLocalPhotoSender();
    }

    return () => {
      console.log('[SyncProvider] Cleaning up local photo transfer services');
      if (deviceType === 'tablet') {
        cleanupLocalPhotoReceiver();
      } else if (deviceType === 'phone') {
        cleanupLocalPhotoSender();
      }
    };
  }, [isDatabaseReady, localPhotoTransferEnabled, deviceType]);

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
