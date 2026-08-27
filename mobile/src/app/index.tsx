import { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, Image, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Redirect, useLocalSearchParams } from 'expo-router';
import {
  Play,
  RefreshCw,
  Camera,
  Tablet,
  Settings,
  MapPin,
  CalendarClock,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react-native';
import {
  useDeviceStore,
  useDeviceHydrated,
  useDeviceType,
  useTeamId,
} from '@/lib/state/device-store';
import { useTeamAdminAccess } from '@/lib/team-access';
import { cn } from '@/lib/cn';
import { formatEventTime } from '@/lib/events/event-time';

const AATLogo = require('@/assets/aat-logo.png');

export default function HomeScreen() {
  const hasHydrated = useDeviceHydrated();
  const teamId = useTeamId();
  const deviceType = useDeviceType();
  const adminPin = useDeviceStore((s) => s.adminPin);
  const reset = useDeviceStore((s) => s.reset);
  const currentEventId = useDeviceStore((s) => s.currentEventId);
  const currentEventVenue = useDeviceStore((s) => s.currentEventVenue);
  const currentEventEndAt = useDeviceStore((s) => s.currentEventEndAt);
  const currentEventTimeZone = useDeviceStore((s) => s.currentEventTimeZone);
  // Only admin teams get the Admin tile. Field teams shouldn't see a door they
  // can't open (the layout blocks them anyway if they get there another way).
  const { isAdminTeam } = useTeamAdminAccess();

  // Set by the event watcher when it ends an event on its own, so the crew is
  // told why the tablet dropped out of the kiosk instead of guessing.
  const { eventEnded } = useLocalSearchParams<{ eventEnded?: string }>();
  const justEnded = eventEnded === '1';

  const [showResetModal, setShowResetModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const isConfigured = teamId !== null && deviceType !== null;
  const hasEvent = currentEventId !== null;

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

  // Shown in the venue's zone, so this matches the end time the office typed.
  const endsAtLabel = formatEventTime(currentEventEndAt, currentEventTimeZone);

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

        {/* Event just finished on its own */}
        {justEnded ? (
          <View className="flex-row items-start bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 mb-5">
            <CheckCircle2 size={22} color="#f59e0b" />
            <View className="flex-1 ml-3">
              <Text className="text-amber-400 font-bold text-base">Event finished</Text>
              <Text className="text-amber-200/80 text-sm mt-1">
                Everything collected has been saved. Pick the next event area to keep going.
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
              {hasEvent && endsAtLabel ? (
                <View className="flex-row items-center mt-1">
                  <CalendarClock size={14} color="#71717a" />
                  <Text className="text-zinc-500 text-sm ml-1.5">Ends at {endsAtLabel}</Text>
                </View>
              ) : (
                <Text className="text-zinc-500 text-sm mt-1">
                  {hasEvent ? 'Tap to switch areas' : 'Tap to pick where you are working'}
                </Text>
              )}
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

        {/* Reset Button - small at bottom */}
        <View className="pt-10">
          <Pressable
            onPress={handleResetDevice}
            className="flex-row items-center justify-center py-4 active:opacity-70"
          >
            <RefreshCw size={18} color="#71717a" />
            <Text className="text-zinc-500 ml-2 font-medium">Reset Device</Text>
          </Pressable>
        </View>
      </ScrollView>

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
