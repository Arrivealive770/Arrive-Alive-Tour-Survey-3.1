import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/api/api';

export interface SurveyQuestion {
  id?: string;
  orderIndex: number;
  questionText: string;
  answerType: string;
  options: string[];
  isRequired: boolean;
}

export interface SurveyTypeDefinition {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  questions: SurveyQuestion[];
}

/**
 * The backend aggregates answers by `q<orderIndex>` (see GET
 * /api/surveys/results/:slug), so the kiosk must store them under the same key
 * or every result chart comes back empty.
 */
export function responseKeyFor(question: SurveyQuestion): string {
  return `q${question.orderIndex}`;
}

const CACHE_KEY = 'survey-types-cache-v1';

export const SURVEY_TYPES_QUERY_KEY = ['survey-types'];

/**
 * Questions come from the server but events are run in venues with bad or no
 * Wi-Fi, so the last successful download is kept on the device and used as the
 * fallback. Without this the kiosk is unusable offline.
 */
async function fetchSurveyTypes(): Promise<SurveyTypeDefinition[]> {
  try {
    const types = await api.get<SurveyTypeDefinition[]>(
      '/api/surveys/types?includeInactive=true'
    );
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(types));
    } catch (cacheError) {
      console.warn('[SurveyQuestions] Failed to cache survey types:', cacheError);
    }
    return types;
  } catch (error) {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      console.log('[SurveyQuestions] Offline - using cached survey types');
      return JSON.parse(cached) as SurveyTypeDefinition[];
    }
    throw error;
  }
}

export function useSurveyTypes() {
  return useQuery({
    queryKey: SURVEY_TYPES_QUERY_KEY,
    queryFn: fetchSurveyTypes,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Questions for a single survey type, ordered the way the admin arranged them.
 */
export function useSurveyQuestions(slug: string | null) {
  const { data, isLoading, isError, refetch } = useSurveyTypes();

  const surveyType = useMemo(
    () => (slug ? data?.find((type) => type.slug === slug) ?? null : null),
    [data, slug]
  );

  const questions = useMemo(
    () =>
      surveyType
        ? [...surveyType.questions].sort((a, b) => a.orderIndex - b.orderIndex)
        : [],
    [surveyType]
  );

  return { surveyType, questions, isLoading, isError, refetch };
}
