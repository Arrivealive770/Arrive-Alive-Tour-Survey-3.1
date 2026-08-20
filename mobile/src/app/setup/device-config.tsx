import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Tablet, Camera } from 'lucide-react-native';
import { DeviceRoleCard } from '@/components/setup';
import { useDeviceStore, type DeviceType } from '@/lib/state/device-store';
import { api } from '@/lib/api/api';
import type { Device, RegisterDeviceRequest } from '@/lib/api/types';

export default function DeviceConfigScreen() {
  const [selectedRole, setSelectedRole] = useState<DeviceType | null>(null);

  const teamId = useDeviceStore((s) => s.teamId);
  const codeType = useDeviceStore((s) => s.codeType);
  const setDeviceConfig = useDeviceStore((s) => s.setDeviceConfig);

  const registerDeviceMutation = useMutation({
    mutationFn: async (deviceType: DeviceType) => {
      const request = {
        teamId: teamId!,
        deviceName: `${deviceType === 'tablet' ? 'Tablet' : 'Phone'} ${Date.now()}`,
        deviceType: deviceType,
      };
      const device = await api.post<Device>('/api/devices', request);
      return device;
    },
    onSuccess: (device) => {
      // Store device info
      setDeviceConfig({
        deviceId: device.id,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
      });
      // Navigate to event setup
      router.push('/setup/event-setup' as any);
    },
    onError: (err: Error) => {
      console.error('Failed to register device:', err);
    },
  });

  // If phone code was used, auto-select phone and register immediately
  useEffect(() => {
    if (codeType === 'phone' && !selectedRole && !registerDeviceMutation.isPending) {
      setSelectedRole('phone');
      registerDeviceMutation.mutate('phone');
    }
  }, [codeType]);

  const handleSelectRole = (role: DeviceType) => {
    setSelectedRole(role);
    registerDeviceMutation.mutate(role);
  };

  const isLoading = registerDeviceMutation.isPending;
  const registerError = registerDeviceMutation.error;

  // Registration needs the server. If it fails, say so instead of leaving the
  // person staring at a spinner or a button that appears to do nothing.
  const renderError = () => (
    <View className="items-center px-4">
      <Text className="text-red-500 text-lg font-semibold text-center">
        Could not reach the server
      </Text>
      <Text className="text-zinc-400 text-center mt-2">
        Check this device&apos;s internet connection and try again.
      </Text>
      <Pressable
        onPress={() => registerDeviceMutation.mutate(selectedRole ?? 'phone')}
        className="mt-6 px-8 h-14 items-center justify-center bg-white rounded-xl active:bg-zinc-200"
      >
        <Text className="text-black font-semibold text-lg">Try Again</Text>
      </Pressable>
    </View>
  );

  // If phone code, show loading while auto-registering
  if (codeType === 'phone') {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-1 items-center justify-center">
          {registerError ? (
            renderError()
          ) : (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text className="text-white mt-4 text-lg">Setting up phone device...</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-8 pt-16">
        {/* Header */}
        <View className="mb-16">
          <Text className="text-4xl font-bold text-white mb-2">
            Select Device Role
          </Text>
          <Text className="text-lg text-zinc-400">
            Choose how this device will be used
          </Text>
        </View>

        {/* Loading Overlay */}
        {isLoading ? (
          <View className="absolute inset-0 z-10 items-center justify-center bg-black/80">
            <ActivityIndicator size="large" color="#fff" />
            <Text className="text-white mt-4 text-lg">Registering device...</Text>
          </View>
        ) : null}

        {/* Device Role Cards */}
        <View className="gap-6">
          <DeviceRoleCard
            title="TABLET - Kiosk Mode"
            description="Survey & Pledge Station"
            icon={Tablet}
            selected={selectedRole === 'tablet'}
            onPress={() => handleSelectRole('tablet')}
          />

          <DeviceRoleCard
            title="PHONE - Photo Hub"
            description="Take Pledge Photos"
            icon={Camera}
            selected={selectedRole === 'phone'}
            onPress={() => handleSelectRole('phone')}
          />
        </View>

        {/* Registration error */}
        {registerError && !isLoading ? (
          <View className="mt-8">{renderError()}</View>
        ) : null}

        {/* Footer note */}
        <View className="flex-1 justify-end pb-8">
          <Text className="text-center text-zinc-600 text-sm">
            You can change this later in the admin settings
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
