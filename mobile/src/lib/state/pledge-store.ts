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
}

interface PledgeActions {
  startPledge: (surveyLocalId: string) => void;
  setPhoto: (photoLocalId: string | null) => void;
  setEmail: (email: string | null) => void;
  completePledge: () => PledgeData;
  reset: () => void;
}

const initialState: PledgeState = {
  surveyLocalId: null,
  selectedPhotoLocalId: null,
  email: null,
};

export const usePledgeStore = create<PledgeState & PledgeActions>()((set, get) => ({
  ...initialState,

  startPledge: (surveyLocalId) => {
    set({
      surveyLocalId,
      selectedPhotoLocalId: null,
      email: null,
    });
  },

  setPhoto: (photoLocalId) => {
    set({ selectedPhotoLocalId: photoLocalId });
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
