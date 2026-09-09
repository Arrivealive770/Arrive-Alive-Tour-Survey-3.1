import { useEffect, useRef, useCallback } from 'react';
import { View, PanResponder } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

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
  // Screens pushed earlier in the kiosk stack stay mounted behind the current
  // one, and their pan responder never sees another touch. Without this check
  // an old screen's countdown keeps running and resets the session out from
  // under the guest partway through the survey.
  const isFocused = useIsFocused();
  const isActive = enabled && isFocused;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isActive) {
      timerRef.current = setTimeout(() => {
        onReset();
      }, timeoutMs);
    }
  }, [timeoutMs, onReset, isActive]);

  // The pan responder below is built once, so it reaches the current
  // resetTimer through a ref rather than closing over the first render's copy.
  const resetTimerRef = useRef(resetTimer);
  resetTimerRef.current = resetTimer;

  // Start (or restart) the countdown whenever this screen becomes active again
  useEffect(() => {
    resetTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [resetTimer]);

  // Pan responder to detect any touch
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        resetTimerRef.current();
        return false; // Don't capture the gesture, just observe
      },
      onMoveShouldSetPanResponder: () => {
        resetTimerRef.current();
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
