import { useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, BackHandler, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { recordCrash } from '@/lib/crash-guard';
import { useDeviceStore } from '@/lib/state/device-store';
import { useSurveyStore } from '@/lib/state/survey-store';
import { usePledgeStore } from '@/lib/state/pledge-store';

/**
 * Shown instead of a crash anywhere in the kiosk flow — the survey, the age
 * question, the pledge, the thank-you screen.
 *
 * A crew running an event can't read a log, and a tablet that closes itself
 * mid-session tells nobody anything. This keeps the app open, puts the actual
 * error on screen where it can be read out over the phone, and gives the crew
 * one button to get the next guest started.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    // Save it too, so it's still readable from the menu after a restart.
    recordCrash(error, false);
  }, [error]);

  const backToMenu = useCallback(() => {
    useSurveyStore.getState().reset();
    usePledgeStore.getState().reset();
    retry().catch(() => {});
  }, [retry]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <View style={{ flex: 1, padding: 28, justifyContent: 'center' }}>
        <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '700', marginBottom: 8 }}>
          Something went wrong
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 15, marginBottom: 20 }}>
          The survey stopped here. Read the message below to whoever supports the app,
          then tap Start Over for the next guest.
        </Text>

        <ScrollView
          style={{
            maxHeight: 240,
            backgroundColor: '#18181b',
            borderRadius: 12,
            padding: 14,
            marginBottom: 24,
          }}
        >
          <Text style={{ color: '#f4f4f5', fontSize: 13 }}>
            {error?.message ?? 'Unknown error'}
          </Text>
          {error?.stack ? (
            <Text style={{ color: '#71717a', fontSize: 11, marginTop: 10 }}>{error.stack}</Text>
          ) : null}
        </ScrollView>

        <Pressable
          onPress={backToMenu}
          style={{
            backgroundColor: '#22c55e',
            borderRadius: 14,
            paddingVertical: 18,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#000000', fontSize: 18, fontWeight: '700' }}>Start Over</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

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
      // Drop whatever the last guest had part-finished. Anything they actually
      // completed was already queued for sync; leaving the rest in memory would
      // carry their answers into the next area.
      useSurveyStore.getState().reset();
      usePledgeStore.getState().reset();
      exitKioskMode();
      // Back to the main menu — photo and survey options, plus the picker for
      // the next event area.
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
