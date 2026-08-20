import { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { DeviceStatusCard } from '@/components/admin/DeviceStatusCard';
import { useDeviceStore } from '@/lib/state/device-store';
import { useSyncStore } from '@/lib/state/sync-store';
import { api } from '@/lib/api/api';
import type { Device } from '@/lib/api/types';

// A device counts as online if the server heard from it recently.
const ONLINE_WINDOW_MS = 10 * 60 * 1000;

export default function DevicesScreen() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentDeviceId = useDeviceStore((s) => s.deviceId);
  const teamId = useDeviceStore((s) => s.teamId);
  const isOnline = useSyncStore((s) => s.isOnline);
  const pendingCount = useSyncStore((s) => s.pendingSurveys + s.pendingPledges + s.pendingPhotos);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'devices', teamId],
    enabled: !!teamId,
    queryFn: () => api.get<Device[]>(`/api/devices?teamId=${teamId}`),
  });

  const devices = (data ?? []).filter((device) => device.isActive);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const isRecentlySynced = (device: Device) =>
    !!device.lastSyncAt && Date.now() - new Date(device.lastSyncAt).getTime() < ONLINE_WINDOW_MS;

  const onlineDevices = devices.filter(isRecentlySynced);
  const offlineDevices = devices.filter((device) => !isRecentlySynced(device));

  // Only this device knows its own queue depth; other devices report on sync.
  const totalPending = pendingCount;

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#3b82f6"
        />
      }
    >
      {/* Summary Stats */}
      <View className="flex-row mb-6 gap-3">
        <View className="flex-1 bg-zinc-900 rounded-2xl p-4 items-center">
          <View className="flex-row items-center mb-1">
            <Wifi size={16} color="#22c55e" />
            <Text className="text-green-500 font-bold text-2xl ml-2">
              {onlineDevices.length}
            </Text>
          </View>
          <Text className="text-zinc-500 text-sm">Online</Text>
        </View>

        <View className="flex-1 bg-zinc-900 rounded-2xl p-4 items-center">
          <View className="flex-row items-center mb-1">
            <WifiOff size={16} color="#ef4444" />
            <Text className="text-red-500 font-bold text-2xl ml-2">
              {offlineDevices.length}
            </Text>
          </View>
          <Text className="text-zinc-500 text-sm">Offline</Text>
        </View>

        <View className="flex-1 bg-zinc-900 rounded-2xl p-4 items-center">
          <View className="flex-row items-center mb-1">
            <AlertTriangle
              size={16}
              color={totalPending > 0 ? '#f59e0b' : '#22c55e'}
            />
            <Text
              className={`font-bold text-2xl ml-2 ${
                totalPending > 0 ? 'text-amber-500' : 'text-green-500'
              }`}
            >
              {totalPending}
            </Text>
          </View>
          <Text className="text-zinc-500 text-sm">Pending</Text>
        </View>
      </View>

      {/* This Device */}
      {currentDeviceId ? (
        <View className="mb-6">
          <Text className="text-white text-lg font-semibold mb-3">This Device</Text>
          <View className="bg-blue-500/10 rounded-2xl p-4 border border-blue-500/30">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View
                  className={`w-3 h-3 rounded-full mr-3 ${
                    isOnline ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <View>
                  <Text className="text-white font-semibold">Current Device</Text>
                  <Text className="text-zinc-400 text-sm">ID: {currentDeviceId.slice(0, 8)}...</Text>
                </View>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${
                  isOnline ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isOnline ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {/* Online Devices */}
      {onlineDevices.length > 0 ? (
        <View className="mb-6">
          <Text className="text-white text-lg font-semibold mb-3">
            Online Devices ({onlineDevices.length})
          </Text>
          {onlineDevices.map((device) => (
            <DeviceStatusCard
              key={device.id}
              id={device.id}
              name={device.deviceName}
              type={device.deviceType}
              lastSyncTime={device.lastSyncAt}
              pendingCount={device.id === currentDeviceId ? pendingCount : 0}
              isOnline
            />
          ))}
        </View>
      ) : null}

      {/* Offline Devices */}
      {offlineDevices.length > 0 ? (
        <View className="mb-6">
          <Text className="text-white text-lg font-semibold mb-3">
            Offline Devices ({offlineDevices.length})
          </Text>
          {offlineDevices.map((device) => (
            <DeviceStatusCard
              key={device.id}
              id={device.id}
              name={device.deviceName}
              type={device.deviceType}
              lastSyncTime={device.lastSyncAt}
              pendingCount={device.id === currentDeviceId ? pendingCount : 0}
              isOnline={false}
            />
          ))}
        </View>
      ) : null}

      {/* Empty / error states */}
      {isLoading ? (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : null}
      {isError ? (
        <View className="bg-zinc-900/50 rounded-xl p-4 mt-2">
          <Text className="text-zinc-400 text-sm text-center">
            Could not load devices. Pull down to try again.
          </Text>
        </View>
      ) : null}
      {!isLoading && !isError && devices.length === 0 ? (
        <View className="bg-zinc-900/50 rounded-xl p-4 mt-2">
          <Text className="text-zinc-400 text-sm text-center">
            No devices registered for this team yet.
          </Text>
        </View>
      ) : null}

      {/* Help Text */}
      <View className="bg-zinc-900/50 rounded-xl p-4 mt-2">
        <Text className="text-zinc-500 text-sm text-center">
          Pull down to refresh. A device shows as offline if it hasn&apos;t synced in
          the last 10 minutes.
        </Text>
      </View>
    </ScrollView>
  );
}
