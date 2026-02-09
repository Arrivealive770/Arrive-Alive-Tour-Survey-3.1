import { useEffect, useRef, useCallback } from 'react';
import { View, PanResponder } from 'react-native';

interface IdleResetTimerProps {
  timeoutMs: number;
  onReset: () => void;
  enabled?: boolean;
  children: React.ReactNode;
}

export function IdleResetTimer({
  timeoutMs,
  onReset,
  enabled = true,
  children
}: IdleResetTimerProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (enabled) {
      timerRef.current = setTimeout(() => {
        onReset();
      }, timeoutMs);
    }
  }, [timeoutMs, onReset, enabled]);

  // Initialize timer on mount
  useEffect(() => {
    resetTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resetTimer]);

  // Pan responder to detect any touch
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        resetTimer();
        return false; // Don't capture the gesture, just observe
      },
      onMoveShouldSetPanResponder: () => {
        resetTimer();
        return false;
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
