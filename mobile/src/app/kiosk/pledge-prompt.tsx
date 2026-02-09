import { useCallback } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CheckCircle, Shield } from 'lucide-react-native';
import { IdleResetTimer } from '@/components/kiosk';
import { useSurveyStore } from '@/lib/state/survey-store';
import { usePledgeStore } from '@/lib/state/pledge-store';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IDLE_TIMEOUT = 60000; // 60 seconds

interface ActionButtonProps {
  label: string;
  sublabel?: string;
  variant: 'primary' | 'secondary';
  onPress: () => void;
}

function ActionButton({ label, sublabel, variant, onPress }: ActionButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(
      variant === 'primary'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light
    );
    onPress();
  }, [variant, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isPrimary = variant === 'primary';

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        animatedStyle,
        {
          width: '100%',
          minHeight: 80,
          backgroundColor: isPrimary ? '#22c55e' : '#27272a',
          borderRadius: 20,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 20,
          paddingHorizontal: 24,
        },
      ]}
    >
      <Text
        className="font-bold text-center"
        style={{
          fontSize: 22,
          color: isPrimary ? '#000000' : '#a1a1aa',
        }}
      >
        {label}
      </Text>
      {sublabel ? (
        <Text
          className="text-center mt-1"
          style={{
            fontSize: 14,
            color: isPrimary ? '#166534' : '#71717a',
          }}
        >
          {sublabel}
        </Text>
      ) : null}
    </AnimatedPressable>
  );
}

export default function PledgePromptScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const reset = useSurveyStore((s) => s.reset);
  const startPledge = usePledgeStore((s) => s.startPledge);

  const isTablet = width > 600;

  const handleTakePledge = useCallback(() => {
    // Start pledge flow with the current survey's local ID (if available)
    startPledge('');
    router.push('/kiosk/pledge' as any);
  }, [startPledge, router]);

  const handleDecline = useCallback(() => {
    // Reset and go back to survey type selection for next participant
    reset();
    router.replace('/kiosk' as any);
  }, [reset, router]);

  // Handle idle reset
  const handleIdleReset = useCallback(() => {
    reset();
    router.replace('/kiosk' as any);
  }, [reset, router]);

  return (
    <IdleResetTimer
      timeoutMs={IDLE_TIMEOUT}
      onReset={handleIdleReset}
      enabled={true}
    >
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        <View className="flex-1 px-8 justify-center">
          {/* Thank You Message */}
          <Animated.View
            entering={FadeIn.duration(500)}
            className="items-center mb-12"
          >
            <View className="mb-6 p-5 bg-green-500/20 rounded-full">
              <CheckCircle size={isTablet ? 80 : 64} color="#22c55e" />
            </View>
            <Text
              className="text-white font-bold text-center mb-4"
              style={{ fontSize: isTablet ? 40 : 32 }}
            >
              Thank You!
            </Text>
            <Text
              className="text-zinc-400 text-center leading-relaxed"
              style={{ fontSize: isTablet ? 20 : 18 }}
            >
              Your responses have been recorded.
            </Text>
          </Animated.View>

          {/* Pledge Prompt */}
          <Animated.View
            entering={FadeIn.duration(500).delay(300)}
            className="mb-10"
          >
            <View className="flex-row items-center justify-center mb-4">
              <Shield size={24} color="#22c55e" />
              <Text
                className="text-white font-semibold ml-2"
                style={{ fontSize: isTablet ? 22 : 18 }}
              >
                S.A.F.E. Pledge
              </Text>
            </View>
            <Text
              className="text-zinc-300 text-center leading-relaxed"
              style={{ fontSize: isTablet ? 20 : 17 }}
            >
              Would you like to take our pledge to drive{'\n'}
              <Text className="text-green-400 font-semibold">
                Sober And Free of Electronics
              </Text>
              ?
            </Text>
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View
            entering={FadeIn.duration(500).delay(500)}
            className="gap-4"
          >
            <ActionButton
              label="Take the Pledge"
              sublabel="Get your photo taken"
              variant="primary"
              onPress={handleTakePledge}
            />
            <ActionButton
              label="No Thank You"
              variant="secondary"
              onPress={handleDecline}
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    </IdleResetTimer>
  );
}
