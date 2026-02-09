import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface SurveyResponse {
  questionId: string;
  answer: string | string[] | number | boolean;
  answeredAt: string;
}

interface SurveyState {
  // Current survey session
  currentSurveyType: string | null;
  currentQuestionIndex: number;
  responses: Record<string, SurveyResponse>;
  startTime: number | null;

  // Age range collected at start (if required)
  ageRange: string | null;
}

interface CompletedSurvey {
  localId: string;
  surveyTypeSlug: string;
  responses: Record<string, SurveyResponse>;
  ageRange: string | null;
  completedAt: string;
  durationSeconds: number;
}

interface SurveyActions {
  startSurvey: (surveyTypeSlug: string, ageRange?: string) => void;
  setResponse: (questionId: string, answer: SurveyResponse['answer']) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  goToQuestion: (index: number) => void;
  completeSurvey: () => CompletedSurvey | null;
  reset: () => void;
}

const initialState: SurveyState = {
  currentSurveyType: null,
  currentQuestionIndex: 0,
  responses: {},
  startTime: null,
  ageRange: null,
};

export const useSurveyStore = create<SurveyState & SurveyActions>()((set, get) => ({
  ...initialState,

  startSurvey: (surveyTypeSlug, ageRange) => {
    set({
      currentSurveyType: surveyTypeSlug,
      currentQuestionIndex: 0,
      responses: {},
      startTime: Date.now(),
      ageRange: ageRange ?? null,
    });
  },

  setResponse: (questionId, answer) => {
    const response: SurveyResponse = {
      questionId,
      answer,
      answeredAt: new Date().toISOString(),
    };
    set((state) => ({
      responses: {
        ...state.responses,
        [questionId]: response,
      },
    }));
  },

  nextQuestion: () => {
    set((state) => ({
      currentQuestionIndex: state.currentQuestionIndex + 1,
    }));
  },

  previousQuestion: () => {
    set((state) => ({
      currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1),
    }));
  },

  goToQuestion: (index) => {
    set({ currentQuestionIndex: Math.max(0, index) });
  },

  completeSurvey: () => {
    const state = get();

    if (!state.currentSurveyType || !state.startTime) {
      return null;
    }

    const completedAt = new Date().toISOString();
    const durationSeconds = Math.round((Date.now() - state.startTime) / 1000);

    const completedSurvey: CompletedSurvey = {
      localId: uuidv4(),
      surveyTypeSlug: state.currentSurveyType,
      responses: { ...state.responses },
      ageRange: state.ageRange,
      completedAt,
      durationSeconds,
    };

    // Reset state after completing
    set(initialState);

    return completedSurvey;
  },

  reset: () => {
    set(initialState);
  },
}));

// Selector hooks for accessing specific state slices
export const useCurrentSurveyType = () => useSurveyStore((s) => s.currentSurveyType);
export const useCurrentQuestionIndex = () => useSurveyStore((s) => s.currentQuestionIndex);
export const useSurveyResponses = () => useSurveyStore((s) => s.responses);
export const useSurveyStartTime = () => useSurveyStore((s) => s.startTime);
export const useSurveyAgeRange = () => useSurveyStore((s) => s.ageRange);
export const useIsSurveyActive = () => useSurveyStore((s) => s.currentSurveyType !== null);
