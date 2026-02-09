import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncError {
  id: string;
  type: 'survey' | 'pledge' | 'photo';
  localId: string;
  message: string;
  timestamp: string;
}

interface SyncState {
  // Connection status
  isOnline: boolean;

  // Sync operation status
  isSyncing: boolean;
  lastSyncAt: string | null;

  // Pending counts
  pendingSurveys: number;
  pendingPledges: number;
  pendingPhotos: number;

  // Errors
  syncErrors: SyncError[];
}

interface SyncActions {
  setOnlineStatus: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  setLastSyncAt: (timestamp: string) => void;
  updateCounts: (counts: Partial<Pick<SyncState, 'pendingSurveys' | 'pendingPledges' | 'pendingPhotos'>>) => void;
  addError: (error: Omit<SyncError, 'id' | 'timestamp'>) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  reset: () => void;
}

const initialState: SyncState = {
  isOnline: false,
  isSyncing: false,
  lastSyncAt: null,
  pendingSurveys: 0,
  pendingPledges: 0,
  pendingPhotos: 0,
  syncErrors: [],
};

export const useSyncStore = create<SyncState & SyncActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setOnlineStatus: (isOnline) => {
        set({ isOnline });
      },

      setSyncing: (isSyncing) => {
        set({ isSyncing });
      },

      setLastSyncAt: (timestamp) => {
        set({ lastSyncAt: timestamp });
      },

      updateCounts: (counts) => {
        set((state) => ({
          ...state,
          ...counts,
        }));
      },

      addError: (error) => {
        const newError: SyncError = {
          ...error,
          id: `${error.type}-${error.localId}-${Date.now()}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          syncErrors: [...state.syncErrors.slice(-49), newError], // Keep last 50 errors
        }));
      },

      removeError: (id) => {
        set((state) => ({
          syncErrors: state.syncErrors.filter((e) => e.id !== id),
        }));
      },

      clearErrors: () => {
        set({ syncErrors: [] });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'sync-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist lastSyncAt, not ephemeral state
      partialize: (state) => ({
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);

// Selector hooks for accessing specific state slices
export const useIsOnline = () => useSyncStore((s) => s.isOnline);
export const useIsSyncing = () => useSyncStore((s) => s.isSyncing);
export const useLastSyncAt = () => useSyncStore((s) => s.lastSyncAt);
export const usePendingSurveyCount = () => useSyncStore((s) => s.pendingSurveys);
export const usePendingPledgeCount = () => useSyncStore((s) => s.pendingPledges);
export const usePendingPhotoCount = () => useSyncStore((s) => s.pendingPhotos);
export const useSyncErrors = () => useSyncStore((s) => s.syncErrors);
export const useTotalPendingCount = () =>
  useSyncStore((s) => s.pendingSurveys + s.pendingPledges + s.pendingPhotos);
export const useHasSyncErrors = () => useSyncStore((s) => s.syncErrors.length > 0);
