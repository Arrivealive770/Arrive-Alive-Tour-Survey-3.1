import { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react-native';
import { DeviceStatusCard } from '@/components/admin/DeviceStatusCard';
import { useDeviceStore } from '@/lib/state/device-store';
import { useSyncStore } from '@/lib/state/sync-store';
import type { Device } from '@/lib/api/types';

// Mock devices for demonstration
const MOCK_DEVICES: (Device & { pendingCount: number; isOnline: boolean })[] = [
  {
    id: 'device-1',
    teamId: 'team-1',
    deviceName: 'Tablet 1',
    deviceType: 'tablet',
    isActive: true,
    lastSyncAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
    createdAt: new Date().toISOString(),
    pendingCount: 0,
    isOnline: true,
  },
  {
    id: 'device-2',
    teamId: 'team-1',
    deviceName: 'Tablet 2',
    deviceType: 'tablet',
    isActive: true,
    lastSyncAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    createdAt: new Date().toISOString(),
    pendingCount: 5,
    isOnline: true,
  },
  {
    id: 'device-3',
    teamId: 'team-1',
    deviceName: 'Photo Hub',
    deviceType: 'phone',
    isActive: true,
    lastSyncAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    createdAt: new Date().toISOString(),
    pendingCount: 3,
    isOnline: true,
  },
  {
    id: 'device-4',
    teamId: 'team-1',
    deviceName: 'Tablet 3',
    deviceType: 'tablet',
    isActive: true,
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    createdAt: new Date().toISOString(),
    pendingCount: 12,
    isOnline: false,
  },
];

export default function DevicesScreen() {
  const [devices, setDevices] = useState(MOCK_DEVICES);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentDeviceId = useDeviceStore((s) => s.deviceId);
  const isOnline = useSyncStore((s) => s.isOnline);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // In real app, would fetch devices from API
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate updating device status
    setDevices((prev) =>
      prev.map((device) => ({
        ...device,
        lastSyncAt: device.isOnline ? new Date().toISOString() : device.lastSyncAt,
      }))
    );

    setIsRefreshing(false);
  }, []);

  const onlineDevices = devices.filter((d) => d.isOnline);
  const offlineDevices = devices.filter((d) => !d.isOnline);

  const totalPending = devices.reduce((sum, d) => sum + d.pendingCount, 0);

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
              pendingCount={device.pendingCount}
              isOnline={device.isOnline}
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
              pendingCount={device.pendingCount}
              isOnline={device.isOnline}
            />
          ))}
        </View>
      ) : null}

      {/* Help Text */}
      <View className="bg-zinc-900/50 rounded-xl p-4 mt-2">
        <Text className="text-zinc-500 text-sm text-center">
          Pull down to refresh device status. Devices are considered offline if they
          haven't synced in the last 30 minutes.
        </Text>
      </View>
    </ScrollView>
  );
}
