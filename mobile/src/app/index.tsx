import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, Image, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Redirect } from 'expo-router';
import {
  Play,
  RefreshCw,
  Camera,
  Tablet,
  Settings,
  MapPin,
  Flag,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react-native';
import {
  useDeviceStore,
  useDeviceHydrated,
  useDeviceType,
  useTeamId,
} from '@/lib/state/device-store';
import { useSurveyStore } from '@/lib/state/survey-store';
import { usePledgeStore } from '@/lib/state/pledge-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { useTeamAdminAccess } from '@/lib/team-access';
import { cn } from '@/lib/cn';
import { fetchAndApplyUpdate, updateStamp } from '@/lib/updates';
import { clearLastCrash, getLastCrash, type CrashRecord } from '@/lib/crash-guard';

const AATLogo = require('@/assets/aat-logo.png');

export default function HomeScreen() {
  const hasHydrated = useDeviceHydrated();
  const teamId = useTeamId();
  const deviceType = useDeviceType();
  const adminPin = useDeviceStore((s) => s.adminPin);
  const reset = useDeviceStore((s) => s.reset);
  const currentEventId = useDeviceStore((s) => s.currentEventId);
  const currentEventVenue = useDeviceStore((s) => s.currentEventVenue);
  const currentEventStatus = useDeviceStore((s) => s.currentEventStatus);
  const { db } = useDatabase();
  // Only admin teams get the Admin tile. Field teams shouldn't see a door they
  // can't open (the layout blocks them anyway if they get there another way).
  const { isAdminTeam } = useTeamAdminAccess();

  const [showResetModal, setShowResetModal] = useState(false);
  const [showEndEventModal, setShowEndEventModal] = useState(false);
  const [justEnded, setJustEnded] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const isConfigured = teamId !== null && deviceType !== null;
  const hasEvent = currentEventId !== null;

  // Drop the "Event ended" note once the next area is chosen.
  useEffect(() => {
    if (currentEventId) setJustEnded(false);
  }, [currentEventId]);

  const handleStartKiosk = () => {
    if (!hasEvent) {
      handleChangeEvent();
      return;
    }
    router.push('/kiosk' as any);
  };

  const handleOpenPhotoHub = () => {
    if (!hasEvent) {
      handleChangeEvent();
      return;
    }
    router.push('/photo-hub' as any);
  };

  // Picking the next area never asks for the team code again — the device stays
  // paired, only the event changes.
  const handleChangeEvent = () => {
    router.push('/setup/event-setup' as any);
  };

  const handleOpenAdmin = () => {
    router.push('/admin' as any);
  };

  // Ending an event is now the only way an event ends. Nothing about the clock
  // or the calendar closes one on its own any more — a crew running two hours
  // past the scheduled finish keeps working, and the tablet says nothing.
  //
  // This is deliberately not the same thing as Reset Device: it clears the
  // event and the current guest session, and leaves the tablet paired to the
  // team and ready for the next area. Answers and pledges already collected sit
  // in the sync queue and are untouched.
  const handleConfirmEndEvent = () => {
    setShowEndEventModal(false);

    useSurveyStore.getState().reset();
    usePledgeStore.getState().reset();
    useDeviceStore.getState().clearCurrentEvent();

    db?.clearCurrentEvent().catch((err: unknown) => {
      console.error('[Home] Could not clear the local event row:', err);
    });

    setJustEnded(true);
  };

  const handleResetDevice = () => {
    setShowResetModal(true);
    setPinInput('');
    setPinError(false);
  };

  const handleConfirmReset = () => {
    if (pinInput === adminPin) {
      reset();
      setShowResetModal(false);
      router.replace('/setup' as any);
    } else {
      setPinError(true);
    }
  };

  // Saved settings load asynchronously. Rendering a decision before they arrive
  // would bounce an already-configured device back to setup on every cold start.
  if (!hasHydrated) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Redirect to setup if not configured
  if (!isConfigured) {
    return <Redirect href="/setup" />;
  }

  // The office can still mark an event complete from the admin portal. That is
  // shown here rather than acted on: closing the kiosk out from under a crew
  // mid-shift is exactly the behaviour that was taken out.
  const officeMarkedComplete = hasEvent && currentEventStatus === 'completed';

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 24, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View className="items-center mb-5">
          <Image source={AATLogo} style={{ width: 180, height: 90 }} resizeMode="contain" />
        </View>

        {/* Header */}
        <View className="mb-6">
          <Text className="text-4xl font-bold text-white mb-2">Arrive Alive Tour</Text>
          <View className="flex-row items-center">
            {deviceType === 'tablet' ? (
              <Tablet size={20} color="#a1a1aa" />
            ) : (
              <Camera size={20} color="#a1a1aa" />
            )}
            <Text className="text-lg text-zinc-400 ml-2">
              {deviceType === 'tablet' ? 'Tablet Kiosk' : 'Phone Photo Hub'}
            </Text>
          </View>
        </View>

        {/* Confirmation after the crew ends an event themselves */}
        {justEnded ? (
          <View className="flex-row items-start bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 mb-5">
            <CheckCircle2 size={22} color="#f59e0b" />
            <View className="flex-1 ml-3">
              <Text className="text-amber-400 font-bold text-base">Event ended</Text>
              <Text className="text-amber-200/80 text-sm mt-1">
                Everything collected has been saved. Pick the next event area to keep going.
              </Text>
            </View>
          </View>
        ) : null}

        {/* The office closed this event off. Said, not done — the crew decides
            when to stop, and Sync keeps working either way. */}
        {officeMarkedComplete ? (
          <View className="flex-row items-start bg-zinc-800/60 border border-zinc-700 rounded-2xl p-4 mb-5">
            <CheckCircle2 size={22} color="#a1a1aa" />
            <View className="flex-1 ml-3">
              <Text className="text-zinc-200 font-bold text-base">
                The office marked this event complete
              </Text>
              <Text className="text-zinc-400 text-sm mt-1">
                You can keep collecting. Tap End Event below when you are actually done here.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Current event / area picker */}
        <Pressable
          onPress={handleChangeEvent}
          className={cn(
            'rounded-2xl p-5 mb-5 border',
            hasEvent ? 'bg-zinc-900 border-zinc-800' : 'bg-blue-600/10 border-blue-500'
          )}
        >
          <View className="flex-row items-center">
            <View
              className={cn(
                'w-12 h-12 rounded-full items-center justify-center mr-4',
                hasEvent ? 'bg-zinc-800' : 'bg-blue-600'
              )}
            >
              <MapPin size={24} color={hasEvent ? '#a1a1aa' : '#fff'} />
            </View>
            <View className="flex-1">
              <Text className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
                {hasEvent ? 'Current Event Area' : 'No Event Selected'}
              </Text>
              <Text className="text-xl font-bold text-white" numberOfLines={1}>
                {currentEventVenue ?? (hasEvent ? 'Event in progress' : 'Choose an event area')}
              </Text>
              {/* The scheduled end time used to be shown here. It no longer
                  governs anything, and a tablet promising "Ends at 9:00 PM"
                  while happily collecting at 11 is worse than saying nothing. */}
              <Text className="text-zinc-500 text-sm mt-1">
                {hasEvent ? 'Tap to switch areas' : 'Tap to pick where you are working'}
              </Text>
            </View>
            <ChevronRight size={22} color="#71717a" />
          </View>
        </Pressable>

        {/* Survey + Photo options. Both are always offered so a crew can run
            either station from whichever device is free, with this device's
            registered role listed first. */}
        <View className="gap-4">
          {deviceType === 'tablet' ? (
            <>
              <MenuTile
                primary
                Icon={Play}
                title="Start Survey Kiosk"
                subtitle="Begin survey collection"
                onPress={handleStartKiosk}
                disabled={!hasEvent}
              />
              <MenuTile
                Icon={Camera}
                title="Photo Hub"
                subtitle="Take pledge photos"
                onPress={handleOpenPhotoHub}
                disabled={!hasEvent}
              />
            </>
          ) : (
            <>
              <MenuTile
                primary
                Icon={Camera}
                title="Open Photo Hub"
                subtitle="Take pledge photos"
                onPress={handleOpenPhotoHub}
                disabled={!hasEvent}
              />
              <MenuTile
                Icon={Play}
                title="Survey Kiosk"
                subtitle="Begin survey collection"
                onPress={handleStartKiosk}
                disabled={!hasEvent}
              />
            </>
          )}

          {/* Admin - admin teams only, then PIN protected by the admin layout */}
          {isAdminTeam ? (
            <Pressable
              onPress={handleOpenAdmin}
              className="flex-row items-center w-full h-20 px-6 bg-zinc-900 rounded-2xl active:bg-zinc-800"
            >
              <View className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center mr-4">
                <Settings size={24} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-white">Admin</Text>
                <Text className="text-sm text-zinc-500">Events, devices and results</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        {/* End Event — only offered while one is running. This is the switch
            that used to be a clock. */}
        {hasEvent ? (
          <View className="pt-8">
            <Pressable
              onPress={() => setShowEndEventModal(true)}
              className="flex-row items-center justify-center h-16 bg-zinc-900 border border-zinc-800 rounded-2xl active:bg-zinc-800"
            >
              <Flag size={20} color="#e4e4e7" />
              <Text className="text-zinc-200 ml-2.5 font-semibold text-lg">End Event</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Reset Button - small at bottom */}
        <View className="pt-6">
          <Pressable
            onPress={handleResetDevice}
            className="flex-row items-center justify-center py-4 active:opacity-70"
          >
            <RefreshCw size={18} color="#71717a" />
            <Text className="text-zinc-500 ml-2 font-medium">Reset Device</Text>
          </Pressable>
        </View>

        <LastCrashNotice />
        <BuildStamp />
      </ScrollView>

      {/* End Event Confirmation. No PIN: the crew needs this in the middle of
          a busy night, and it doesn't throw anything away. */}
      <Modal
        visible={showEndEventModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEndEventModal(false)}
      >
        <View className="flex-1 bg-black/80 items-center justify-center px-8">
          <View className="w-full bg-zinc-900 rounded-2xl p-6">
            <Text className="text-2xl font-bold text-white mb-2">End Event</Text>
            <Text className="text-zinc-400 mb-2">
              Finish up at {currentEventVenue ?? 'this area'}?
            </Text>
            <Text className="text-zinc-500 mb-6">
              Every survey and pledge collected here is already saved and will keep syncing.
              This just clears the area from the tablet so you can pick the next one.
            </Text>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowEndEventModal(false)}
                className="flex-1 h-14 items-center justify-center bg-zinc-800 rounded-xl active:bg-zinc-700"
              >
                <Text className="text-white font-semibold text-lg">Keep Going</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmEndEvent}
                className="flex-1 h-14 items-center justify-center bg-white rounded-xl active:bg-zinc-200"
              >
                <Text className="text-black font-semibold text-lg">End Event</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        visible={showResetModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowResetModal(false)}
      >
        <View className="flex-1 bg-black/80 items-center justify-center px-8">
          <View className="w-full bg-zinc-900 rounded-2xl p-6">
            <Text className="text-2xl font-bold text-white mb-2">
              Reset Device
            </Text>
            <Text className="text-zinc-400 mb-6">
              Enter the admin PIN to reset this device and clear all settings.
            </Text>

            <TextInput
              value={pinInput}
              onChangeText={(text) => {
                setPinInput(text);
                setPinError(false);
              }}
              placeholder="Enter PIN"
              placeholderTextColor="#666"
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              className={cn(
                'w-full h-16 px-5 text-xl text-center text-white',
                'bg-zinc-800 rounded-xl mb-4',
                'border-2',
                pinError ? 'border-red-500' : 'border-zinc-700'
              )}
            />

            {pinError ? (
              <Text className="text-red-500 text-center mb-4">
                Incorrect PIN. Please try again.
              </Text>
            ) : null}

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowResetModal(false)}
                className="flex-1 h-14 items-center justify-center bg-zinc-800 rounded-xl active:bg-zinc-700"
              >
                <Text className="text-white font-semibold text-lg">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmReset}
                className="flex-1 h-14 items-center justify-center bg-red-600 rounded-xl active:bg-red-700"
              >
                <Text className="text-white font-semibold text-lg">Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/**
 * Shows the last crash this tablet recorded, if there was one.
 *
 * The point is to make a crash readable by whoever is holding the tablet.
 * Before this, an error thrown in the background closed the app with nothing
 * left behind, and the only way to find out why was a USB cable and a laptop.
 *
 * Tap to see the full detail, tap "Clear" once it has been dealt with.
 */
function LastCrashNotice() {
  const [crash, setCrash] = useState<CrashRecord | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    getLastCrash().then((record) => {
      if (active) setCrash(record);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!crash) return null;

  return (
    <View className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
      <Pressable onPress={() => setExpanded((value) => !value)}>
        <Text className="text-red-400 font-bold text-sm">
          An error was recorded on this tablet
        </Text>
        <Text className="text-red-200/80 text-xs mt-1" numberOfLines={expanded ? undefined : 2}>
          {crash.message}
        </Text>
        {expanded ? (
          <>
            <Text className="text-red-200/60 text-[10px] mt-2">{crash.when}</Text>
            <ScrollView style={{ maxHeight: 200 }} className="mt-2">
              <Text className="text-red-200/70 text-[10px]">{crash.stack}</Text>
            </ScrollView>
          </>
        ) : (
          <Text className="text-red-300/60 text-xs mt-2">Tap to see the details</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          clearLastCrash();
          setCrash(null);
        }}
        className="mt-3 self-start rounded-lg bg-red-500/20 px-3 py-2 active:opacity-70"
      >
        <Text className="text-red-300 text-xs font-semibold">Clear</Text>
      </Pressable>
    </View>
  );
}

/**
 * The build this tablet is actually running, plus a way to pull a newer one.
 *
 * This exists so "is it still crashing, or did it never get the fix?" can be
 * answered by looking at a tablet instead of guessing. Read the code out over
 * the phone and it's obvious whether an update landed.
 *
 * Tapping it forces an update rather than waiting for the next restart — the
 * crew shouldn't need a technician to get a fix onto a device.
 */
function BuildStamp() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCheck = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('Checking for updates…');

    const result = await fetchAndApplyUpdate();

    if (result.status === 'installing') {
      // The app restarts into the new version; this message is the last thing
      // on screen before it does.
      setStatus('Update found — restarting…');
      return;
    }

    setBusy(false);
    setStatus(
      result.status === 'up-to-date'
        ? 'Up to date'
        : result.status === 'disabled'
          ? 'Updates are off in this build'
          : 'No connection to the update server'
    );
  };

  return (
    <Pressable onPress={handleCheck} className="items-center pt-2 pb-1 active:opacity-70">
      <Text className="text-zinc-700 text-xs">{updateStamp()}</Text>
      {status ? <Text className="text-zinc-600 text-xs mt-1">{status}</Text> : null}
    </Pressable>
  );
}

interface MenuTileProps {
  Icon: typeof Play;
  title: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}

/**
 * A station option on the main menu. `disabled` is a look, not a block — with
 * no event chosen the tile still responds and sends the crew to pick an area,
 * which is what they need to do next anyway.
 */
function MenuTile({ Icon, title, subtitle, onPress, primary, disabled }: MenuTileProps) {
  const dimmed = !!disabled;

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center w-full px-6 rounded-2xl',
        primary ? 'h-24' : 'h-20',
        primary && !dimmed ? 'bg-white active:bg-zinc-200' : 'bg-zinc-900 active:bg-zinc-800'
      )}
    >
      <View
        className={cn(
          'rounded-full items-center justify-center mr-4',
          primary ? 'w-16 h-16' : 'w-12 h-12',
          primary && !dimmed ? 'bg-black' : 'bg-zinc-800'
        )}
      >
        <Icon size={primary ? 32 : 24} color={primary && !dimmed ? '#fff' : '#a1a1aa'} />
      </View>
      <View className="flex-1">
        <Text
          className={cn(
            'font-bold',
            primary ? 'text-2xl' : 'text-xl',
            primary && !dimmed ? 'text-black' : 'text-white'
          )}
        >
          {title}
        </Text>
        <Text
          className={cn(
            primary ? 'text-base' : 'text-sm',
            primary && !dimmed ? 'text-zinc-500' : 'text-zinc-500'
          )}
        >
          {dimmed ? 'Select an event area first' : subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
