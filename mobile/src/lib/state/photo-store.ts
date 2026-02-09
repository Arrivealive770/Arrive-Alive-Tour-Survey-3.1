import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

// Photo queue item for phone uploads
export interface PhotoQueueEntry {
  localId: string;
  localPath: string;
  overlayType: string;
  capturedAt: string;
}

interface PhotoState {
  // Queue of photos to upload
  photoQueue: PhotoQueueEntry[];

  // Currently selected overlay type
  selectedOverlay: string | null;
}

interface PhotoActions {
  addPhoto: (localPath: string, overlayType: string) => PhotoQueueEntry;
  removePhoto: (localId: string) => void;
  setOverlay: (overlayType: string | null) => void;
  getQueue: () => PhotoQueueEntry[];
  clearQueue: () => void;
  reset: () => void;
}

const initialState: PhotoState = {
  photoQueue: [],
  selectedOverlay: null,
};

export const usePhotoStore = create<PhotoState & PhotoActions>()((set, get) => ({
  ...initialState,

  addPhoto: (localPath, overlayType) => {
    const entry: PhotoQueueEntry = {
      localId: uuidv4(),
      localPath,
      overlayType,
      capturedAt: new Date().toISOString(),
    };
    set((state) => ({
      photoQueue: [...state.photoQueue, entry],
    }));
    return entry;
  },

  removePhoto: (localId) => {
    set((state) => ({
      photoQueue: state.photoQueue.filter((p) => p.localId !== localId),
    }));
  },

  setOverlay: (overlayType) => {
    set({ selectedOverlay: overlayType });
  },

  getQueue: () => {
    return get().photoQueue;
  },

  clearQueue: () => {
    set({ photoQueue: [] });
  },

  reset: () => {
    set(initialState);
  },
}));

// Selector hooks for accessing specific state slices
export const usePhotoQueue = () => usePhotoStore((s) => s.photoQueue);
export const usePhotoQueueCount = () => usePhotoStore((s) => s.photoQueue.length);
export const useSelectedOverlay = () => usePhotoStore((s) => s.selectedOverlay);
