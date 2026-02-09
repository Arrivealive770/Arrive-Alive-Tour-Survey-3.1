import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring
} from 'react-native-reanimated';

interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = current / total;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${withSpring(progress * 100, { damping: 15, stiffness: 100 })}%`,
    };
  }, [progress]);

  return (
    <View className="w-full px-6 py-4">
      <Text className="text-white text-lg font-medium text-center mb-3">
        Question {current} of {total}
      </Text>
      <View className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
        <Animated.View
          className="h-full bg-green-500 rounded-full"
          style={animatedStyle}
        />
      </View>
    </View>
  );
}
