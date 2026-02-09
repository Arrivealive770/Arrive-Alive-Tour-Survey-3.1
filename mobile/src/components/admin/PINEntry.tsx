import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Delete } from 'lucide-react-native';
import { cn } from '@/lib/cn';

interface PINEntryProps {
  onComplete: (pin: string) => boolean;
  title?: string;
  subtitle?: string;
}

const PIN_LENGTH = 4;

export function PINEntry({ onComplete, title = 'Enter PIN', subtitle }: PINEntryProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState(false);
  const shakeX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const handlePress = (digit: string) => {
    if (pin.length >= PIN_LENGTH) return;

    const newPin = pin + digit;
    setPin(newPin);
    setError(false);

    // Check if PIN is complete
    if (newPin.length === PIN_LENGTH) {
      const isCorrect = onComplete(newPin);
      if (!isCorrect) {
        // Shake animation on error
        shakeX.value = withSequence(
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );
        setError(true);
        // Clear PIN after short delay
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const renderDots = () => {
    const dots = [];
    for (let i = 0; i < PIN_LENGTH; i++) {
      dots.push(
        <View
          key={i}
          className={cn(
            'w-4 h-4 rounded-full mx-3',
            i < pin.length
              ? error
                ? 'bg-red-500'
                : 'bg-white'
              : 'bg-zinc-700 border border-zinc-600'
          )}
        />
      );
    }
    return dots;
  };

  const digits = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'back'],
  ];

  return (
    <View className="flex-1 bg-black items-center justify-center px-6">
      <Text className="text-white text-2xl font-bold mb-2">{title}</Text>
      {subtitle ? (
        <Text className="text-zinc-400 text-base mb-8">{subtitle}</Text>
      ) : null}

      <Animated.View style={animatedStyle} className="flex-row mb-12">
        {renderDots()}
      </Animated.View>

      {error ? (
        <Text className="text-red-500 text-sm mb-4">Incorrect PIN</Text>
      ) : (
        <View className="h-5 mb-4" />
      )}

      <View className="w-full max-w-xs">
        {digits.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row justify-center mb-4">
            {row.map((digit, colIndex) => {
              if (digit === '') {
                return <View key={colIndex} className="w-20 h-20 mx-2" />;
              }
              if (digit === 'back') {
                return (
                  <Pressable
                    key={colIndex}
                    onPress={handleBackspace}
                    className="w-20 h-20 mx-2 items-center justify-center active:opacity-50"
                  >
                    <Delete size={28} color="#a1a1aa" />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={colIndex}
                  onPress={() => handlePress(digit)}
                  className="w-20 h-20 mx-2 rounded-full bg-zinc-800 items-center justify-center active:bg-zinc-700"
                >
                  <Text className="text-white text-3xl font-semibold">{digit}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
