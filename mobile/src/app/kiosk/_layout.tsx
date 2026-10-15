import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, BackHandler, StatusBar, Platform } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useDeviceStore } from '@/lib/state/device-store';
import { useSurveyStore } from '@/lib/state/survey-store';
import { usePledgeStore } from '@/lib/state/pledge-store';
import { api } from '@/lib/api/api';
import type { Photo } from '@/lib/api/types';
import { StaffMenuContext } from '@/components/kiosk';

// There is no visible way out of the survey. Staff open the Staff Menu by
// holding the top-right corner for this long — long enough that no student
// does it by accident — or by triple-tapping a heading (StaffTripleTap).
const STAFF_HOLD_MS = 3000;

// A guest who walks away mid-survey would leave their answers on screen for
// the next person, so two minutes untouched on one screen starts over. Every new
// screen gets its own full two minutes.
const GUEST_IDLE_MS = 120_000;

// Only the question screens. Question 1 is left out because it is the start
// screen when an event has one survey, so there is nothing to reset. The
// pledge photo and email screens are left out because a guest can sit on them
// waiting for a photo or typing, and typing doesn't count as touching the screen.
const IDLE_RESET_SCREENS = /^\/kiosk\/(survey\/\d+|demographics|pledge-prompt)$/;

export default function KioskLayout() {
  const router = useRouter();
  const exitKioskMode = useDeviceStore((s) => s.exitKioskMode);

  const pathname = usePathname();

  const [staffPanelOpen, setStaffPanelOpen] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Holding the hidden corner or triple-tapping a heading opens the staff
  // panel. A triple tap used to exit immediately, which students were hitting
  // by accident, so both only open the menu.
  const openStaffMenu = useCallback(() => {
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

  // Paused while the Staff Menu is open: staff are at the tablet.
  const idleResetOn =
    !staffPanelOpen && IDLE_RESET_SCREENS.test(pathname) && pathname !== '/kiosk/survey/1';

  const restartIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = idleResetOn ? setTimeout(handleStartOver, GUEST_IDLE_MS) : null;
  }, [idleResetOn, handleStartOver]);

  useEffect(() => {
    restartIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [restartIdleTimer, pathname]);

  return (
    <View
      className="flex-1 bg-black"
      // Sees every touch anywhere on screen before the button under it does,
      // and returns false so the touch carries on as normal.
      onStartShouldSetResponderCapture={() => {
        restartIdleTimer();
        return false;
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Hidden press-and-hold trigger in top-right corner (staff only) */}
      <Pressable
        onLongPress={openStaffMenu}
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

      <StaffMenuContext.Provider value={openStaffMenu}>
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
      </StaffMenuContext.Provider>

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
