import { create } from 'zustand';

// Cached photo from the cloud for tablet display
export interface CachedPhoto {
  localId: string;
  localPath: string;
  overlayType: string;
  status: 'available' | 'claimed' | 'used';
  createdAt: string;
}

interface PhotoCacheState {
  // All cached photos
  cachedPhotos: CachedPhoto[];

  // Currently selected photo for pledge
  currentSelectedPhoto: CachedPhoto | null;
}

interface PhotoCacheActions {
  setCachedPhotos: (photos: CachedPhoto[]) => void;
  addCachedPhoto: (photo: CachedPhoto) => void;
  selectPhoto: (localId: string) => CachedPhoto | null;
  markPhotoUsed: (localId: string) => void;
  getAvailablePhotos: () => CachedPhoto[];
  clearSelection: () => void;
  clearCache: () => void;
  reset: () => void;
}

const initialState: PhotoCacheState = {
  cachedPhotos: [],
  currentSelectedPhoto: null,
};

export const usePhotoCacheStore = create<PhotoCacheState & PhotoCacheActions>()((set, get) => ({
  ...initialState,

  setCachedPhotos: (photos) => {
    set({ cachedPhotos: photos });
  },

  addCachedPhoto: (photo) => {
    set((state) => ({
      cachedPhotos: [...state.cachedPhotos, photo],
    }));
  },

  selectPhoto: (localId) => {
    const photo = get().cachedPhotos.find((p) => p.localId === localId);
    if (photo && photo.status === 'available') {
      // Mark as claimed in local state
      set((state) => ({
        cachedPhotos: state.cachedPhotos.map((p) =>
          p.localId === localId ? { ...p, status: 'claimed' as const } : p
        ),
        currentSelectedPhoto: { ...photo, status: 'claimed' as const },
      }));
      return photo;
    }
    return null;
  },

  markPhotoUsed: (localId) => {
    set((state) => ({
      cachedPhotos: state.cachedPhotos.map((p) =>
        p.localId === localId ? { ...p, status: 'used' as const } : p
      ),
      currentSelectedPhoto:
        state.currentSelectedPhoto?.localId === localId
          ? { ...state.currentSelectedPhoto, status: 'used' as const }
          : state.currentSelectedPhoto,
    }));
  },

  getAvailablePhotos: () => {
    return get().cachedPhotos.filter((p) => p.status === 'available');
  },

  clearSelection: () => {
    const selected = get().currentSelectedPhoto;
    if (selected && selected.status === 'claimed') {
      // Release the claimed photo back to available
      set((state) => ({
        cachedPhotos: state.cachedPhotos.map((p) =>
          p.localId === selected.localId ? { ...p, status: 'available' as const } : p
        ),
        currentSelectedPhoto: null,
      }));
    } else {
      set({ currentSelectedPhoto: null });
    }
  },

  clearCache: () => {
    set({ cachedPhotos: [], currentSelectedPhoto: null });
  },

  reset: () => {
    set(initialState);
  },
}));

// Selector hooks for accessing specific state slices
export const useCachedPhotos = () => usePhotoCacheStore((s) => s.cachedPhotos);
export const useCurrentSelectedPhoto = () => usePhotoCacheStore((s) => s.currentSelectedPhoto);
export const useAvailablePhotoCount = () =>
  usePhotoCacheStore((s) => s.cachedPhotos.filter((p) => p.status === 'available').length);
export const useTotalCachedPhotos = () => usePhotoCacheStore((s) => s.cachedPhotos.length);
