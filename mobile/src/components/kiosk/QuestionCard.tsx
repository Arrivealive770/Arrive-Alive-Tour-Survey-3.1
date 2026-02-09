import { View, Text, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface QuestionCardProps {
  questionText: string;
  questionNumber: number;
}

export function QuestionCard({ questionText, questionNumber }: QuestionCardProps) {
  const { width } = useWindowDimensions();

  // Scale font size based on question length and screen width
  const getFontSize = () => {
    const charCount = questionText.length;
    if (charCount < 50) return 32;
    if (charCount < 100) return 28;
    if (charCount < 150) return 24;
    return 20;
  };

  const fontSize = getFontSize();
  const isTablet = width > 600;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      className="flex-1 items-center justify-center px-8"
    >
      <Text
        className="text-white text-center font-semibold leading-relaxed"
        style={{
          fontSize: isTablet ? fontSize + 4 : fontSize,
          lineHeight: isTablet ? (fontSize + 4) * 1.4 : fontSize * 1.4,
        }}
      >
        {questionText}
      </Text>
    </Animated.View>
  );
}
