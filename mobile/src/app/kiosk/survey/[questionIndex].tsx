import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { ProgressBar, QuestionCard, AnswerButton, IdleResetTimer } from '@/components/kiosk';
import { useSurveyQuestions, responseKeyFor } from '@/lib/survey-questions';
import { useSurveyStore, toAnswerMap } from '@/lib/state/survey-store';
import { useSyncStore } from '@/lib/state/sync-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { useDeviceStore } from '@/lib/state/device-store';

const AUTO_ADVANCE_DELAY = 300;
const IDLE_TIMEOUT = 60000; // 60 seconds

export default function QuestionScreen() {
  const router = useRouter();
  const { questionIndex: questionIndexParam } = useLocalSearchParams<{ questionIndex: string }>();
  const questionIndex = parseInt(questionIndexParam || '1', 10);

  const { db, isReady } = useDatabase();
  const deviceId = useDeviceStore((s) => s.deviceId);
  const teamId = useDeviceStore((s) => s.teamId);
  const currentEventId = useDeviceStore((s) => s.currentEventId);

  const currentSurveyType = useSurveyStore((s) => s.currentSurveyType);
  const setResponse = useSurveyStore((s) => s.setResponse);
  const completeSurvey = useSurveyStore((s) => s.completeSurvey);
  const reset = useSurveyStore((s) => s.reset);

  const updateCounts = useSyncStore((s) => s.updateCounts);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real questions for the selected survey type (cached locally for offline use)
  const { questions, isLoading, isError, refetch } = useSurveyQuestions(currentSurveyType);
  const totalQuestions = questions.length;
  const currentQuestion = questions[questionIndex - 1] ?? null;
  const questionKey = currentQuestion ? responseKeyFor(currentQuestion) : '';

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  // Reset the selection when the question changes. This deliberately does NOT
  // depend on the stored response: re-running on every answer would clear
  // isProcessing mid auto-advance and let a second tap skip a question.
  useEffect(() => {
    const existing = questionKey ? useSurveyStore.getState().responses[questionKey] : undefined;
    setSelectedAnswer((existing?.answer as string) ?? null);
    setIsProcessing(false);
  }, [questionIndex, questionKey]);

  // Handle answer selection with auto-advance
  const handleAnswerSelect = useCallback(
    async (value: string) => {
      if (isProcessing || !questionKey) return;

      setSelectedAnswer(value);
      setIsProcessing(true);

      // Store the response under the key the backend aggregates by
      setResponse(questionKey, value);

      // Set up auto-advance
      advanceTimerRef.current = setTimeout(async () => {
        if (questionIndex >= totalQuestions) {
          // Last question - complete survey and navigate
          const completed = completeSurvey();

          if (completed && isReady && db) {
            try {
              // Get current event info
              const currentEvent = await db.getCurrentEvent();

              // Queue the survey for sync
              await db.queueSurvey({
                localId: completed.localId,
                teamId: teamId || currentEvent?.teamId || 'unknown',
                eventId: currentEvent?.eventId || currentEventId || 'unknown',
                surveyTypeSlug: completed.surveyTypeSlug,
                responses: JSON.stringify(toAnswerMap(completed.responses)),
                ageRange: completed.ageRange,
                deviceId: deviceId,
                completedAt: completed.completedAt,
                durationSeconds: completed.durationSeconds,
              });

              // Update pending count
              const counts = await db.getSurveyQueueCount();
              updateCounts({ pendingSurveys: counts.pending + counts.failed });

              console.log('[QuestionScreen] Survey queued:', completed.localId);
            } catch (error) {
              console.error('[QuestionScreen] Error queuing survey:', error);
            }
          }

          // Navigate to demographics
          router.replace('/kiosk/demographics' as any);
        } else {
          // Navigate to next question
          router.push(`/kiosk/survey/${questionIndex + 1}` as any);
        }

        setIsProcessing(false);
      }, AUTO_ADVANCE_DELAY);
    },
    [
      isProcessing,
      questionKey,
      totalQuestions,
      questionIndex,
      setResponse,
      completeSurvey,
      isReady,
      db,
      teamId,
      currentEventId,
      deviceId,
      updateCounts,
      router,
    ]
  );

  // Handle idle reset - go back to survey type selection
  const handleIdleReset = useCallback(() => {
    reset();
    router.replace('/kiosk' as any);
  }, [reset, router]);

  // Redirect if no survey is active
  useEffect(() => {
    if (!currentSurveyType) {
      router.replace('/kiosk' as any);
    }
  }, [currentSurveyType, router]);

  // Out-of-range index (e.g. a shortened survey) - restart cleanly
  useEffect(() => {
    if (!isLoading && totalQuestions > 0 && questionIndex > totalQuestions) {
      router.replace('/kiosk/survey/1' as any);
    }
  }, [isLoading, totalQuestions, questionIndex, router]);

  if (!currentSurveyType) {
    return null;
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#22c55e" />
        <Text className="text-zinc-400 mt-4 text-lg">Loading questions...</Text>
      </SafeAreaView>
    );
  }

  // No questions available: either the server is unreachable and nothing was
  // ever cached, or this survey type has no questions set up yet.
  if (isError || !currentQuestion) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center px-10">
        <AlertTriangle size={56} color="#ef4444" />
        <Text className="text-white text-2xl font-bold mt-6 text-center">
          Questions Unavailable
        </Text>
        <Text className="text-zinc-400 text-base mt-2 text-center">
          {isError
            ? 'Could not download the survey questions. Connect this device to the internet once, then try again.'
            : 'This survey has no questions set up yet. Add them in the admin portal.'}
        </Text>
        <View className="flex-row gap-3 mt-8">
          <Pressable
            onPress={() => refetch()}
            className="px-6 h-14 items-center justify-center bg-white rounded-xl active:bg-zinc-200"
          >
            <Text className="text-black font-semibold text-lg">Try Again</Text>
          </Pressable>
          <Pressable
            onPress={handleIdleReset}
            className="px-6 h-14 items-center justify-center bg-zinc-800 rounded-xl active:bg-zinc-700"
          >
            <Text className="text-white font-semibold text-lg">Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <IdleResetTimer
      timeoutMs={IDLE_TIMEOUT}
      onReset={handleIdleReset}
      enabled={!isProcessing}
    >
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        {/* Progress Bar */}
        <ProgressBar current={questionIndex} total={totalQuestions} />

        {/* Question */}
        <QuestionCard
          questionText={currentQuestion.questionText}
          questionNumber={questionIndex}
        />

        {/* Answer Options */}
        <View className="px-6 pb-8">
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {currentQuestion.options.map((option) => (
              <AnswerButton
                key={option}
                text={option}
                value={option}
                isSelected={selectedAnswer === option}
                onPress={handleAnswerSelect}
                disabled={isProcessing}
              />
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </IdleResetTimer>
  );
}
