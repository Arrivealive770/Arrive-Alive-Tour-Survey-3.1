import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Pressable, BackHandler, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';
import { useDeviceStore } from '@/lib/state/device-store';
import { KioskExitModal } from '@/components/kiosk';

export default function KioskLayout() {
  const router = useRouter();
  const adminPin = useDeviceStore((s) => s.adminPin);
  const exitKioskMode = useDeviceStore((s) => s.exitKioskMode);

  const [showExitModal, setShowExitModal] = useState(false);
  const tapCountRef = useRef(0);
  const lastTapRef = useRef<number>(0);

  // Keep screen awake in kiosk mode
  useEffect(() => {
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

  // Triple tap detection for exit modal
  const handleCornerTap = useCallback(() => {
    const now = Date.now();

    if (now - lastTapRef.current < 500) {
      tapCountRef.current += 1;
    } else {
      tapCountRef.current = 1;
    }

    lastTapRef.current = now;

    if (tapCountRef.current >= 3) {
      setShowExitModal(true);
      tapCountRef.current = 0;
    }
  }, []);

  const handleExitSuccess = useCallback(() => {
    exitKioskMode(adminPin);
    setShowExitModal(false);
    router.replace('/');
  }, [exitKioskMode, adminPin, router]);

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

      <KioskExitModal
        visible={showExitModal}
        correctPin={adminPin}
        onSuccess={handleExitSuccess}
        onClose={() => setShowExitModal(false)}
      />
    </View>
  );
}
