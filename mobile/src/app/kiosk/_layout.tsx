import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, BackHandler, StatusBar, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useDeviceStore } from '@/lib/state/device-store';
import { useSurveyStore } from '@/lib/state/survey-store';
import { usePledgeStore } from '@/lib/state/pledge-store';
import { api } from '@/lib/api/api';
import type { Photo } from '@/lib/api/types';

// A guest has to be able to lean on the screen, hand the tablet to a friend and
// take as long as they like, so nothing here is on a timer and there is no
// visible way out of the survey. Staff get out by holding the top-right corner
// for this long — long enough that no student does it by accident.
const STAFF_HOLD_MS = 3000;

export default function KioskLayout() {
  const router = useRouter();
  const exitKioskMode = useDeviceStore((s) => s.exitKioskMode);

  const [staffPanelOpen, setStaffPanelOpen] = useState(false);

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

  // Holding the hidden corner opens the staff panel. It used to be a triple tap
  // that exited immediately, which students were hitting by accident.
  const handleCornerHold = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setStaffPanelOpen(true);
  }, []);

  // Drop whatever the last guest had part-finished. Anything they actually
  // completed was already queued for sync; leaving the rest in memory would
  // carry their answers into the next guest's session.
  const clearGuestSession = useCallback(() => {
    const photoId = usePledgeStore.getState().selectedPhotoId;
    if (photoId) {
      // Hand the photo back to the pool instead of stranding it as reserved.
      api.put<Photo>(`/api/photos/${photoId}/release`, {}).catch(() => {});
    }
    useSurveyStore.getState().reset();
    usePledgeStore.getState().reset();
  }, []);

  // Fresh start for the next guest, without leaving kiosk mode.
  const handleStartOver = useCallback(() => {
    setStaffPanelOpen(false);
    clearGuestSession();
    router.replace('/kiosk');
  }, [clearGuestSession, router]);

  const handleExitKiosk = useCallback(() => {
    setStaffPanelOpen(false);
    clearGuestSession();
    exitKioskMode();
    // Back to the main menu — photo and survey options, plus the picker for
    // the next event area.
    router.replace('/');
  }, [clearGuestSession, exitKioskMode, router]);

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Hidden press-and-hold trigger in top-right corner (staff only) */}
      <Pressable
        onLongPress={handleCornerHold}
        delayLongPress={STAFF_HOLD_MS}
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

      {staffPanelOpen ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 200,
            backgroundColor: 'rgba(0,0,0,0.85)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          <View className="w-full max-w-md bg-zinc-900 rounded-3xl p-8 border border-zinc-800">
            <Text className="text-white text-3xl font-bold text-center">Staff Menu</Text>
            <Text className="text-zinc-400 text-base text-center mt-2 mb-8">
              The guest&apos;s screen is paused behind this.
            </Text>

            <StaffButton
              label="Start Over"
              sublabel="Clear this session and go back to the first screen"
              tone="primary"
              onPress={handleStartOver}
            />
            <StaffButton
              label="Exit Kiosk Mode"
              sublabel="Return to the main menu"
              tone="danger"
              onPress={handleExitKiosk}
            />
            <StaffButton
              label="Cancel"
              sublabel="Go back to the guest's survey"
              tone="neutral"
              onPress={() => setStaffPanelOpen(false)}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

interface StaffButtonProps {
  label: string;
  sublabel: string;
  tone: 'primary' | 'danger' | 'neutral';
  onPress: () => void;
}

const STAFF_BUTTON_TONES = {
  primary: { bg: '#22c55e', label: '#000000', sublabel: '#166534' },
  danger: { bg: '#3f1d1d', label: '#f87171', sublabel: '#a16060' },
  neutral: { bg: '#27272a', label: '#a1a1aa', sublabel: '#71717a' },
} as const;

function StaffButton({ label, sublabel, tone, onPress }: StaffButtonProps) {
  const colors = STAFF_BUTTON_TONES[tone];

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={{
        minHeight: 72,
        backgroundColor: colors.bg,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.label }}>{label}</Text>
      <Text style={{ fontSize: 13, color: colors.sublabel, marginTop: 2 }}>{sublabel}</Text>
    </Pressable>
  );
}
