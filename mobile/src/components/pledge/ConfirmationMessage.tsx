import { useEffect } from 'react';
import { View, Text, Pressable, Linking, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';
import { Check, Facebook, Twitter } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface ConfirmationMessageProps {
  title?: string;
  message?: string;
  showSocialPrompt?: boolean;
}

const PLEDGE_TEXT =
  'Thank you for taking the pledge to drive S.A.F.E. — Sober And Free of Electronics.';

const SOCIAL_PROMPT = 'Please share your pledge on social media using #ArriveAlive';

export function ConfirmationMessage({
  title = 'Thank You!',
  message = PLEDGE_TEXT,
  showSocialPrompt = true,
}: ConfirmationMessageProps) {
  const { width } = useWindowDimensions();
  const isTablet = width > 600;

  const checkmarkScale = useSharedValue(0);

  useEffect(() => {
    // Trigger haptic feedback on mount
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Animate checkmark with spring bounce
    checkmarkScale.value = withSequence(
      withDelay(200, withSpring(1.2, { damping: 8, stiffness: 200 })),
      withSpring(1, { damping: 12, stiffness: 300 })
    );
  }, [checkmarkScale]);

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkmarkScale.value }],
  }));

  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
      {/* Animated Checkmark */}
      <Animated.View
        style={[
          checkmarkStyle,
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
        {title}
      </Animated.Text>

      {/* Message */}
      <Animated.Text
        entering={FadeInUp.duration(500).delay(600)}
        style={{
          color: '#a1a1aa',
          fontSize: isTablet ? 22 : 18,
          textAlign: 'center',
          lineHeight: isTablet ? 34 : 28,
          marginBottom: showSocialPrompt ? (isTablet ? 40 : 32) : 0,
          maxWidth: 500,
        }}
      >
        {message}
      </Animated.Text>

      {/* Social Sharing Prompt */}
      {showSocialPrompt ? (
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
            />
            <SocialIcon
              Icon={Twitter}
              color="#1da1f2"
              label="X"
            />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

interface SocialIconProps {
  Icon: typeof Facebook;
  color: string;
  label: string;
}

function SocialIcon({ Icon, color, label }: SocialIconProps) {
  const { width } = useWindowDimensions();
  const isTablet = width > 600;
  const size = isTablet ? 56 : 48;

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          backgroundColor: '#27272a',
          padding: isTablet ? 16 : 12,
          borderRadius: 16,
        }}
      >
        <Icon size={size - 24} color={color} />
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
