import { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Redirect } from 'expo-router';
import { Play, RefreshCw, Camera, Tablet, Settings } from 'lucide-react-native';
import {
  useDeviceStore,
  useDeviceHydrated,
  useDeviceType,
  useTeamId,
} from '@/lib/state/device-store';
import { cn } from '@/lib/cn';

const AATLogo = require('@/assets/aat-logo.png');

export default function HomeScreen() {
  const hasHydrated = useDeviceHydrated();
  const teamId = useTeamId();
  const deviceType = useDeviceType();
  const adminPin = useDeviceStore((s) => s.adminPin);
  const reset = useDeviceStore((s) => s.reset);

  const [showResetModal, setShowResetModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const isConfigured = teamId !== null && deviceType !== null;

  const handleStartKiosk = () => {
    router.push('/kiosk' as any);
  };

  const handleOpenPhotoHub = () => {
    router.push('/photo-hub' as any);
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

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-8 pt-8">
        {/* Logo */}
        <View className="items-center mb-6">
          <Image
            source={AATLogo}
            style={{ width: 180, height: 90 }}
            resizeMode="contain"
          />
        </View>

        {/* Header */}
        <View className="mb-12">
          <Text className="text-4xl font-bold text-white mb-2">
            Arrive Alive Tour
          </Text>
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

        {/* Main Action Button */}
        <View className="gap-4">
          {deviceType === 'tablet' ? (
            <Pressable
              onPress={handleStartKiosk}
              className="flex-row items-center w-full h-24 px-6 bg-white rounded-2xl active:bg-zinc-200"
            >
              <View className="w-16 h-16 rounded-full bg-black items-center justify-center mr-4">
                <Play size={32} color="#fff" fill="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-black">Start Kiosk</Text>
                <Text className="text-base text-zinc-500">Begin survey collection</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleOpenPhotoHub}
              className="flex-row items-center w-full h-24 px-6 bg-white rounded-2xl active:bg-zinc-200"
            >
              <View className="w-16 h-16 rounded-full bg-black items-center justify-center mr-4">
                <Camera size={32} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-black">Open Photo Hub</Text>
                <Text className="text-base text-zinc-500">Take pledge photos</Text>
              </View>
            </Pressable>
          )}

          {/* Admin - PIN protected by the admin layout */}
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
        </View>

        {/* Reset Button - small at bottom */}
        <View className="flex-1 justify-end pb-8">
          <Pressable
            onPress={handleResetDevice}
            className="flex-row items-center justify-center py-4 active:opacity-70"
          >
            <RefreshCw size={18} color="#71717a" />
            <Text className="text-zinc-500 ml-2 font-medium">Reset Device</Text>
          </Pressable>
        </View>
      </View>

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
