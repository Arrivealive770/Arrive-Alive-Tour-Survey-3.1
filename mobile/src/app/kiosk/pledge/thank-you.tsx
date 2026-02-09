import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Check, Facebook, Twitter } from 'lucide-react-native';
import { usePledgeStore } from '@/lib/state/pledge-store';
import { useSurveyStore } from '@/lib/state/survey-store';

const COUNTDOWN_SECONDS = 10;

const PLEDGE_TEXT =
  'Thank you for taking the pledge to drive S.A.F.E. — Sober And Free of Electronics.';

const SOCIAL_PROMPT = 'Please share your pledge on social media using #ArriveAlive';

export default function ThankYouScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width > 600;

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const resetPledge = usePledgeStore((s) => s.reset);
  const resetSurvey = useSurveyStore((s) => s.reset);

  // Animation values
  const checkScale = useSharedValue(0);

  // Animate check mark on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    checkScale.value = withDelay(
      200,
      withSequence(
        withSpring(1.2, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 300 })
      )
    );
  }, [checkScale]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleFinish = useCallback(() => {
    resetPledge();
    resetSurvey();
    router.replace('/kiosk' as any);
  }, [resetPledge, resetSurvey, router]);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'bottom']}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        {/* Animated Checkmark */}
        <Animated.View
          style={[
            checkAnimatedStyle,
            {
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              padding: isTablet ? 32 : 24,
              borderRadius: 999,
              marginBottom: isTablet ? 32 : 24,
            },
          ]}
        >
          <View
            style={{
              backgroundColor: '#22c55e',
              padding: isTablet ? 24 : 18,
              borderRadius: 999,
            }}
          >
            <Check
              size={isTablet ? 64 : 48}
              color="#000000"
              strokeWidth={3}
            />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.Text
          entering={FadeInUp.duration(500).delay(400)}
          style={{
            color: '#ffffff',
            fontSize: isTablet ? 48 : 36,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: isTablet ? 24 : 16,
          }}
        >
          Thank You!
        </Animated.Text>

        {/* Message */}
        <Animated.Text
          entering={FadeInUp.duration(500).delay(600)}
          style={{
            color: '#a1a1aa',
            fontSize: isTablet ? 22 : 18,
            textAlign: 'center',
            lineHeight: isTablet ? 34 : 28,
            marginBottom: isTablet ? 40 : 32,
            maxWidth: 500,
          }}
        >
          {PLEDGE_TEXT}
        </Animated.Text>

        {/* Social Sharing Prompt */}
        <Animated.View
          entering={FadeIn.duration(500).delay(900)}
          style={{ alignItems: 'center' }}
        >
          <Text
            style={{
              color: '#71717a',
              fontSize: isTablet ? 18 : 15,
              textAlign: 'center',
              marginBottom: isTablet ? 20 : 16,
            }}
          >
            {SOCIAL_PROMPT}
          </Text>

          {/* Social Icons */}
          <View
            style={{
              flexDirection: 'row',
              gap: 24,
            }}
          >
            <SocialIcon
              Icon={Facebook}
              color="#1877f2"
              label="Facebook"
              isTablet={isTablet}
            />
            <SocialIcon
              Icon={Twitter}
              color="#1da1f2"
              label="X"
              isTablet={isTablet}
            />
          </View>
        </Animated.View>

        {/* Countdown and Done Button */}
        <Animated.View
          entering={FadeIn.duration(400).delay(1200)}
          style={{
            position: 'absolute',
            bottom: isTablet ? 48 : 32,
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Pressable
            onPress={handleFinish}
            style={{
              backgroundColor: '#27272a',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                color: '#ffffff',
                fontSize: 16,
                fontWeight: '600',
              }}
            >
              Done
            </Text>
          </Pressable>

          <Text
            style={{
              color: '#52525b',
              fontSize: 14,
            }}
          >
            Returning to survey in{' '}
            <Text style={{ color: '#71717a', fontWeight: '600' }}>{countdown}</Text>
            {' '}seconds...
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

interface SocialIconProps {
  Icon: typeof Facebook;
  color: string;
  label: string;
  isTablet: boolean;
}

function SocialIcon({ Icon, color, label, isTablet }: SocialIconProps) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          backgroundColor: '#27272a',
          padding: isTablet ? 16 : 12,
          borderRadius: 16,
        }}
      >
        <Icon size={isTablet ? 32 : 24} color={color} />
      </View>
      <Text
        style={{
          color: '#52525b',
          fontSize: 12,
          marginTop: 6,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
