import { Pressable, Text, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnswerButtonProps {
  text: string;
  value: string;
  isSelected: boolean;
  onPress: (value: string) => void;
  disabled?: boolean;
}

export function AnswerButton({
  text,
  value,
  isSelected,
  onPress,
  disabled = false
}: AnswerButtonProps) {
  const { width } = useWindowDimensions();
  const scale = useSharedValue(1);
  const backgroundColor = useSharedValue(0);

  const isTablet = width > 600;

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handlePress = useCallback(() => {
    if (disabled) return;

    runOnJS(triggerHaptic)();

    // Animate the button
    scale.value = withSequence(
      withTiming(0.97, { duration: 80 }),
      withTiming(1, { duration: 80 })
    );
    backgroundColor.value = withTiming(1, { duration: 150 });

    // Trigger the callback
    onPress(value);
  }, [disabled, value, onPress, triggerHaptic, scale, backgroundColor]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: isSelected
        ? '#22c55e' // green-500
        : backgroundColor.value === 1
          ? '#22c55e'
          : '#1a1a1a',
    };
  }, [isSelected]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      disabled={disabled}
      style={[
        animatedStyle,
        {
          width: '100%',
          minHeight: isTablet ? 72 : 64,
          borderRadius: 16,
          paddingHorizontal: 24,
          paddingVertical: 18,
          justifyContent: 'center',
          alignItems: 'center',
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        className="text-white font-semibold text-center"
        style={{ fontSize: isTablet ? 22 : 20 }}
      >
        {text}
      </Text>
    </AnimatedPressable>
  );
}
