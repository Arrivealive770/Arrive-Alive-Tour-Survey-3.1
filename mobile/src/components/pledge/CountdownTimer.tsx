import { useEffect, useRef, useCallback } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface CountdownTimerProps {
  seconds: number;
  onComplete: () => void;
  isPaused?: boolean;
  prefix?: string;
  suffix?: string;
}

export function CountdownTimer({
  seconds,
  onComplete,
  isPaused = false,
  prefix = 'Returning to survey in ',
  suffix = '...',
}: CountdownTimerProps) {
  const { width } = useWindowDimensions();
  const isTablet = width > 600;

  const remainingSeconds = useSharedValue(seconds);
  const displaySeconds = useSharedValue(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCompletedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (!hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete();
    }
  }, [onComplete]);

  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Reset completion flag when starting
    hasCompletedRef.current = false;

    // Start countdown
    intervalRef.current = setInterval(() => {
      remainingSeconds.value -= 1;
      displaySeconds.value = Math.max(0, remainingSeconds.value);

      if (remainingSeconds.value <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        runOnJS(handleComplete)();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPaused, remainingSeconds, displaySeconds, handleComplete]);

  // Reset when seconds prop changes
  useEffect(() => {
    remainingSeconds.value = seconds;
    displaySeconds.value = seconds;
    hasCompletedRef.current = false;
  }, [seconds, remainingSeconds, displaySeconds]);

  const animatedOpacity = useSharedValue(1);

  // Pulse animation
  useEffect(() => {
    const pulse = () => {
      animatedOpacity.value = withTiming(0.5, { duration: 500, easing: Easing.inOut(Easing.ease) }, () => {
        animatedOpacity.value = withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) });
      });
    };

    const pulseInterval = setInterval(pulse, 1000);
    return () => clearInterval(pulseInterval);
  }, [animatedOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: animatedOpacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle, { alignItems: 'center' }]}>
      <CountdownText
        displaySeconds={displaySeconds}
        prefix={prefix}
        suffix={suffix}
        isTablet={isTablet}
      />
    </Animated.View>
  );
}

interface CountdownTextProps {
  displaySeconds: Animated.SharedValue<number>;
  prefix: string;
  suffix: string;
  isTablet: boolean;
}

function CountdownText({ displaySeconds, prefix, suffix, isTablet }: CountdownTextProps) {
  const animatedProps = useAnimatedStyle(() => {
    return {};
  });

  // Use a simple state-based approach for the text
  const [currentSeconds, setCurrentSeconds] = React.useState(displaySeconds.value);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSeconds(Math.round(displaySeconds.value));
    }, 100);
    return () => clearInterval(interval);
  }, [displaySeconds]);

  return (
    <Text
      style={{
        color: '#71717a',
        fontSize: isTablet ? 16 : 14,
        textAlign: 'center',
      }}
    >
      {prefix}
      <Text style={{ color: '#a1a1aa', fontWeight: '600' }}>
        {currentSeconds}
      </Text>
      {' seconds'}
      {suffix}
    </Text>
  );
}

import React from 'react';
