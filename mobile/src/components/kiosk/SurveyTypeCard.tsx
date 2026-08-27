import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { LucideIcon } from 'lucide-react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SurveyTypeCardProps {
  name: string;
  slug: string;
  Icon?: LucideIcon;
  onPress: (slug: string) => void;
}

export function SurveyTypeCard({ name, slug, Icon, onPress }: SurveyTypeCardProps) {
  const { width } = useWindowDimensions();
  const scale = useSharedValue(1);

  const isTablet = width > 600;
  const cardSize = isTablet ? (width - 96) / 2 : width - 64;

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress(slug);
  }, [slug, onPress]);

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
          width: cardSize,
          minHeight: isTablet ? 200 : 150,
          backgroundColor: '#1a1a1a',
          borderRadius: 24,
          padding: 24,
          justifyContent: 'center',
          alignItems: 'center',
        },
      ]}
    >
      {Icon ? (
        <View className="mb-4 p-4 bg-zinc-800 rounded-full">
          <Icon size={isTablet ? 48 : 36} color="#ffffff" />
        </View>
      ) : null}
      <Text
        className="text-white font-bold text-center"
        style={{ fontSize: isTablet ? 24 : 20 }}
      >
        {name}
      </Text>
    </AnimatedPressable>
  );
}
