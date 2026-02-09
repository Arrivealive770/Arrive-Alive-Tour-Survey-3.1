import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ProgressBar, QuestionCard, AnswerButton, IdleResetTimer } from '@/components/kiosk';
import { useSurveyStore } from '@/lib/state/survey-store';
import { useSyncStore } from '@/lib/state/sync-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { useDeviceStore } from '@/lib/state/device-store';

// Mock questions - in production these come from API based on survey type
const MOCK_QUESTIONS = [
  {
    id: 'q1',
    text: 'Have you ever driven under the influence of alcohol or drugs?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    id: 'q2',
    text: 'Have you ever been a passenger with someone who was driving under the influence?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    id: 'q3',
    text: 'Do you use your phone while driving?',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'often', label: 'Often' },
      { value: 'always', label: 'Always' },
    ],
  },
  {
    id: 'q4',
    text: 'Do you text while driving?',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'often', label: 'Often' },
      { value: 'always', label: 'Always' },
    ],
  },
  {
    id: 'q5',
    text: 'Do you always wear your seatbelt when driving or riding in a vehicle?',
    options: [
      { value: 'yes', label: 'Yes, always' },
      { value: 'mostly', label: 'Most of the time' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'rarely', label: 'Rarely' },
      { value: 'never', label: 'Never' },
    ],
  },
  {
    id: 'q6',
    text: 'Have you or someone you know been affected by a drunk or distracted driving incident?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    id: 'q7',
    text: 'How often do you think about the consequences of distracted driving?',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'rarely', label: 'Rarely' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'often', label: 'Often' },
    ],
  },
  {
    id: 'q8',
    text: 'Would you intervene if a friend was about to drive under the influence?',
    options: [
      { value: 'definitely', label: 'Definitely yes' },
      { value: 'probably', label: 'Probably yes' },
      { value: 'unsure', label: 'Not sure' },
      { value: 'no', label: 'Probably not' },
    ],
  },
  {
    id: 'q9',
    text: 'Do you have a designated driver plan when going out?',
    options: [
      { value: 'always', label: 'Always' },
      { value: 'usually', label: 'Usually' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'never', label: 'Never' },
    ],
  },
  {
    id: 'q10',
    text: 'How likely are you to use a rideshare service instead of driving after drinking?',
    options: [
      { value: 'very', label: 'Very likely' },
      { value: 'somewhat', label: 'Somewhat likely' },
      { value: 'unlikely', label: 'Unlikely' },
      { value: 'never', label: 'Would not use' },
    ],
  },
  {
    id: 'q11',
    text: 'After this presentation, will you commit to driving Sober And Free of Electronics (S.A.F.E.)?',
    options: [
      { value: 'yes', label: 'Yes, I commit' },
      { value: 'maybe', label: 'I will try' },
      { value: 'no', label: 'Not sure' },
    ],
  },
];

const TOTAL_QUESTIONS = 11;
const AUTO_ADVANCE_DELAY = 300;
const IDLE_TIMEOUT = 60000; // 60 seconds

export default function QuestionScreen() {
  const router = useRouter();
  const { questionIndex: questionIndexParam } = useLocalSearchParams<{ questionIndex: string }>();
  const questionIndex = parseInt(questionIndexParam || '1', 10);

  const { db, isReady } = useDatabase();
  const deviceId = useDeviceStore((s) => s.deviceId);
  const teamId = useDeviceStore((s) => s.teamId);

  const currentSurveyType = useSurveyStore((s) => s.currentSurveyType);
  const responses = useSurveyStore((s) => s.responses);
  const setResponse = useSurveyStore((s) => s.setResponse);
  const completeSurvey = useSurveyStore((s) => s.completeSurvey);
  const reset = useSurveyStore((s) => s.reset);

  const updateCounts = useSyncStore((s) => s.updateCounts);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get current question
  const currentQuestion = useMemo(() => {
    return MOCK_QUESTIONS[questionIndex - 1] || MOCK_QUESTIONS[0];
  }, [questionIndex]);

  // Get existing response for this question
  const existingResponse = responses[currentQuestion.id];

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  // Reset selected answer when question changes
  useEffect(() => {
    setSelectedAnswer(existingResponse?.answer as string || null);
    setIsProcessing(false);
  }, [questionIndex, existingResponse]);

  // Handle answer selection with auto-advance
  const handleAnswerSelect = useCallback(
    async (value: string) => {
      if (isProcessing) return;

      setSelectedAnswer(value);
      setIsProcessing(true);

      // Store the response
      setResponse(currentQuestion.id, value);

      // Set up auto-advance
      advanceTimerRef.current = setTimeout(async () => {
        if (questionIndex >= TOTAL_QUESTIONS) {
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
                eventId: currentEvent?.eventId || 'unknown',
                surveyTypeSlug: completed.surveyTypeSlug,
                responses: JSON.stringify(completed.responses),
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
      currentQuestion.id,
      questionIndex,
      setResponse,
      completeSurvey,
      isReady,
      db,
      teamId,
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

  if (!currentSurveyType) {
    return null;
  }

  return (
    <IdleResetTimer
      timeoutMs={IDLE_TIMEOUT}
      onReset={handleIdleReset}
      enabled={!isProcessing}
    >
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        {/* Progress Bar */}
        <ProgressBar current={questionIndex} total={TOTAL_QUESTIONS} />

        {/* Question */}
        <QuestionCard
          questionText={currentQuestion.text}
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
                key={option.value}
                text={option.label}
                value={option.value}
                isSelected={selectedAnswer === option.value}
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
