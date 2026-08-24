import { useEffect, useRef, useCallback } from 'react';
import { View, Pressable, BackHandler, StatusBar, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useDeviceStore } from '@/lib/state/device-store';

export default function KioskLayout() {
  const router = useRouter();
  const exitKioskMode = useDeviceStore((s) => s.exitKioskMode);

  const tapCountRef = useRef(0);
  const lastTapRef = useRef<number>(0);

  // Keep screen awake in kiosk mode (native only - not supported on web)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    KeepAwake.activateKeepAwakeAsync('kiosk-mode');

    return () => {
      KeepAwake.deactivateKeepAwake('kiosk-mode');
    };
  }, []);

  // Prevent back navigation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Block back button in kiosk mode
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Triple tap the top-right corner leaves kiosk mode straight away — no PIN.
  // Guests won't find it by accident, and staff don't have to remember a code
  // in the middle of a busy event.
  const handleCornerTap = useCallback(() => {
    const now = Date.now();

    if (now - lastTapRef.current < 500) {
      tapCountRef.current += 1;
    } else {
      tapCountRef.current = 1;
    }

    lastTapRef.current = now;

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      exitKioskMode();
      router.replace('/');
    }
  }, [exitKioskMode, router]);

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Hidden triple-tap trigger in top-right corner */}
      <Pressable
        onPress={handleCornerTap}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 60,
          height: 60,
          zIndex: 100,
        }}
      />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'fade',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="survey/[questionIndex]" />
        <Stack.Screen name="demographics" />
        <Stack.Screen name="pledge-prompt" />
        <Stack.Screen name="pledge" />
      </Stack>
    </View>
  );
}
