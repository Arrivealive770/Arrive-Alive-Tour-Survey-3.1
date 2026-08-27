import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { IdleResetTimer } from '@/components/kiosk';
import { useSurveyStore } from '@/lib/state/survey-store';
import { useDatabase } from '@/providers/DatabaseProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const AGE_BRACKETS = [
  { value: '13-17', label: '13-17' },
  { value: '18-24', label: '18-24' },
  { value: '25-34', label: '25-34' },
  { value: '35+', label: '35+' },
];

const IDLE_TIMEOUT = 60000; // 60 seconds

interface AgeBracketButtonProps {
  label: string;
  value: string;
  isSelected: boolean;
  onPress: (value: string) => void;
}

function AgeBracketButton({ label, value, isSelected, onPress }: AgeBracketButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress(value);
  }, [value, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        animatedStyle,
        {
          flex: 1,
          minHeight: 80,
          backgroundColor: isSelected ? '#22c55e' : '#1a1a1a',
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
          marginHorizontal: 8,
        },
      ]}
    >
      <Text
        className="text-white font-bold"
        style={{ fontSize: 24 }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export default function DemographicsScreen() {
  const router = useRouter();
  const reset = useSurveyStore((s) => s.reset);
  const { db } = useDatabase();

  const [selectedAge, setSelectedAge] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const handleAgeSelect = useCallback((value: string) => {
    if (isProcessing) return;

    setSelectedAge(value);
    setIsProcessing(true);

    // The survey row was already queued on the last question, so write the age
    // onto that row rather than letting the answer fall on the floor.
    const localId = useSurveyStore.getState().lastCompletedLocalId;
    if (db && localId) {
      db.updateSurveyAgeRange(localId, value).catch((error) => {
        console.error('[Demographics] Failed to save age range:', error);
      });
    }

    // Auto-advance after selection
    advanceTimerRef.current = setTimeout(() => {
      router.replace('/kiosk/pledge-prompt' as any);
    }, 300);
  }, [isProcessing, router, db]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.replace('/kiosk/pledge-prompt' as any);
  }, [router]);

  // Handle idle reset
  const handleIdleReset = useCallback(() => {
    reset();
    router.replace('/kiosk' as any);
  }, [reset, router]);

  return (
    <IdleResetTimer
      timeoutMs={IDLE_TIMEOUT}
      onReset={handleIdleReset}
      enabled={!isProcessing}
    >
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        <View className="flex-1 px-6 justify-center">
          {/* Header */}
          <View className="mb-12">
            <Text className="text-4xl font-bold text-white text-center mb-3">
              One Quick Question
            </Text>
            <Text className="text-xl text-zinc-400 text-center">
              What is your age bracket? (Optional)
            </Text>
          </View>

          {/* Age Bracket Grid */}
          <View className="flex-row mb-8">
            {AGE_BRACKETS.slice(0, 2).map((bracket) => (
              <AgeBracketButton
                key={bracket.value}
                label={bracket.label}
                value={bracket.value}
                isSelected={selectedAge === bracket.value}
                onPress={handleAgeSelect}
              />
            ))}
          </View>
          <View className="flex-row mb-12">
            {AGE_BRACKETS.slice(2, 4).map((bracket) => (
              <AgeBracketButton
                key={bracket.value}
                label={bracket.label}
                value={bracket.value}
                isSelected={selectedAge === bracket.value}
                onPress={handleAgeSelect}
              />
            ))}
          </View>

          {/* Skip Button */}
          <Pressable
            onPress={handleSkip}
            disabled={isProcessing}
            className="self-center py-4 px-8 active:opacity-70"
          >
            <Text className="text-zinc-500 text-xl font-medium">
              Skip
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </IdleResetTimer>
  );
}
