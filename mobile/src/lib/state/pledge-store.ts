import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface PledgeData {
  localId: string;
  surveyLocalId: string | null;
  photoLocalId: string | null;
  email: string | null;
  createdAt: string;
}

interface PledgeState {
  // Current pledge session
  surveyLocalId: string | null;
  selectedPhotoLocalId: string | null;
  email: string | null;

  // Backend photo state machine (server-side Photo record)
  selectedPhotoId: string | null; // Photo.id (server id, used for transitions)
  selectedPhotoOriginalUrl: string | null; // Photo.storageUrl (original)
  finishedPhotoUrl: string | null; // composited/overlaid url
}

interface PledgeActions {
  startPledge: (surveyLocalId: string) => void;
  setPhoto: (photoLocalId: string | null) => void;
  setBackendPhoto: (params: {
    photoId: string;
    photoLocalId: string;
    originalUrl: string | null;
  }) => void;
  setFinishedPhotoUrl: (url: string | null) => void;
  clearBackendPhoto: () => void;
  setEmail: (email: string | null) => void;
  completePledge: () => PledgeData;
  reset: () => void;
}

const initialState: PledgeState = {
  surveyLocalId: null,
  selectedPhotoLocalId: null,
  email: null,
  selectedPhotoId: null,
  selectedPhotoOriginalUrl: null,
  finishedPhotoUrl: null,
};

export const usePledgeStore = create<PledgeState & PledgeActions>()((set, get) => ({
  ...initialState,

  startPledge: (surveyLocalId) => {
    set({
      surveyLocalId,
      selectedPhotoLocalId: null,
      email: null,
      selectedPhotoId: null,
      selectedPhotoOriginalUrl: null,
      finishedPhotoUrl: null,
    });
  },

  setPhoto: (photoLocalId) => {
    set({ selectedPhotoLocalId: photoLocalId });
  },

  setBackendPhoto: ({ photoId, photoLocalId, originalUrl }) => {
    set({
      selectedPhotoId: photoId,
      selectedPhotoLocalId: photoLocalId,
      selectedPhotoOriginalUrl: originalUrl,
      finishedPhotoUrl: null,
    });
  },

  setFinishedPhotoUrl: (url) => {
    set({ finishedPhotoUrl: url });
  },

  clearBackendPhoto: () => {
    set({
      selectedPhotoId: null,
      selectedPhotoLocalId: null,
      selectedPhotoOriginalUrl: null,
      finishedPhotoUrl: null,
    });
  },

  setEmail: (email) => {
    set({ email });
  },

  completePledge: () => {
    const state = get();

    const pledgeData: PledgeData = {
      localId: uuidv4(),
      surveyLocalId: state.surveyLocalId,
      photoLocalId: state.selectedPhotoLocalId,
      email: state.email,
      createdAt: new Date().toISOString(),
    };

    return pledgeData;
  },

  reset: () => {
    set(initialState);
  },
}));

// Selector hooks for accessing specific state slices
export const usePledgeSurveyLocalId = () => usePledgeStore((s) => s.surveyLocalId);
export const useSelectedPhotoLocalId = () => usePledgeStore((s) => s.selectedPhotoLocalId);
export const usePledgeEmail = () => usePledgeStore((s) => s.email);
export const useIsPledgeActive = () => usePledgeStore((s) => s.surveyLocalId !== null);
