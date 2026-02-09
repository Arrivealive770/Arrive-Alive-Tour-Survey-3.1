import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ClipboardList,
  Camera,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight,
  BarChart3,
  Clock,
} from 'lucide-react-native';
import { SummaryCard } from '@/components/admin/SummaryCard';
import { PieChart, SURVEY_TYPE_COLORS } from '@/components/admin/AnalyticsChart';
import { useSync } from '@/providers/SyncProvider';
import { useSyncStore } from '@/lib/state/sync-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { SURVEY_TYPES } from '@/lib/api/types';

// Mock data for demonstration (in real app, would come from API/database)
const MOCK_TODAY_STATS = {
  surveys: 47,
  pledges: 32,
  surveysByType: [
    { label: 'Marijuana', value: 15, color: SURVEY_TYPE_COLORS.marijuana },
    { label: 'Alcohol', value: 12, color: SURVEY_TYPE_COLORS.alcohol },
    { label: 'Distracted', value: 10, color: SURVEY_TYPE_COLORS.distracted },
    { label: 'Impaired', value: 6, color: SURVEY_TYPE_COLORS.impaired },
    { label: 'Combo', value: 4, color: SURVEY_TYPE_COLORS.combo },
  ],
  recentActivity: [
    { id: '1', type: 'survey', surveyType: 'marijuana', time: '2 min ago' },
    { id: '2', type: 'pledge', email: 'j***@email.com', time: '5 min ago' },
    { id: '3', type: 'survey', surveyType: 'alcohol', time: '8 min ago' },
    { id: '4', type: 'photo', time: '10 min ago' },
    { id: '5', type: 'survey', surveyType: 'distracted', time: '15 min ago' },
  ],
};

export default function AdminDashboard() {
  const router = useRouter();
  const { isOnline, isSyncing, pendingCount, sync, lastSyncAt } = useSync();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pendingSurveys = useSyncStore((s) => s.pendingSurveys);
  const pendingPledges = useSyncStore((s) => s.pendingPledges);
  const pendingPhotos = useSyncStore((s) => s.pendingPhotos);

  const teamCode = useDeviceStore((s) => s.teamCode);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // In real app, would refresh stats from API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  }, []);

  const handleForceSync = async () => {
    try {
      await sync();
    } catch (error) {
      console.error('[AdminDashboard] Sync failed:', error);
    }
  };

  const formatLastSync = () => {
    if (!lastSyncAt) return 'Never';
    const date = new Date(lastSyncAt);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const conversionRate = MOCK_TODAY_STATS.surveys > 0
    ? Math.round((MOCK_TODAY_STATS.pledges / MOCK_TODAY_STATS.surveys) * 100)
    : 0;

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
      {/* Connection Status Banner */}
      <View
        className={`flex-row items-center justify-between p-3 rounded-xl mb-4 ${
          isOnline ? 'bg-green-500/10' : 'bg-red-500/10'
        }`}
      >
        <View className="flex-row items-center">
          {isOnline ? (
            <Wifi size={18} color="#22c55e" />
          ) : (
            <WifiOff size={18} color="#ef4444" />
          )}
          <Text
            className={`ml-2 font-medium ${
              isOnline ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Clock size={14} color="#71717a" />
          <Text className="text-zinc-500 text-sm ml-1">
            Last sync: {formatLastSync()}
          </Text>
        </View>
      </View>

      {/* Summary Cards */}
      <View className="flex-row mb-4">
        <SummaryCard
          icon={ClipboardList}
          label="Surveys Today"
          value={MOCK_TODAY_STATS.surveys}
          accentColor="#3b82f6"
          className="flex-1 mr-2"
        />
        <SummaryCard
          icon={Camera}
          label="Pledges Today"
          value={MOCK_TODAY_STATS.pledges}
          accentColor="#a855f7"
          className="flex-1 ml-2"
        />
      </View>

      <View className="flex-row mb-6">
        <SummaryCard
          icon={RefreshCw}
          label="Pending Sync"
          value={pendingCount}
          accentColor={pendingCount > 0 ? '#f59e0b' : '#22c55e'}
          className="flex-1 mr-2"
        />
        <View className="flex-1 ml-2 bg-zinc-800 rounded-2xl p-4 justify-center items-center">
          <Text className="text-zinc-400 text-sm mb-1">Conversion Rate</Text>
          <Text className="text-white text-3xl font-bold">{conversionRate}%</Text>
          <Text className="text-zinc-500 text-xs">Surveys to Pledges</Text>
        </View>
      </View>

      {/* Survey Breakdown */}
      <View className="bg-zinc-900 rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-lg font-semibold">Surveys by Type</Text>
          <Pressable
            onPress={() => router.push('./analytics' as any)}
            className="flex-row items-center"
          >
            <Text className="text-blue-500 text-sm mr-1">View All</Text>
            <ChevronRight size={16} color="#3b82f6" />
          </Pressable>
        </View>
        <PieChart data={MOCK_TODAY_STATS.surveysByType} />
      </View>

      {/* Force Sync Button */}
      <Pressable
        onPress={handleForceSync}
        disabled={isSyncing || !isOnline}
        className={`flex-row items-center justify-center py-4 rounded-xl mb-4 ${
          isSyncing || !isOnline
            ? 'bg-zinc-800'
            : 'bg-blue-600 active:bg-blue-700'
        }`}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <RefreshCw size={20} color={isOnline ? '#fff' : '#71717a'} />
        )}
        <Text
          className={`font-semibold ml-2 ${
            isSyncing || !isOnline ? 'text-zinc-500' : 'text-white'
          }`}
        >
          {isSyncing ? 'Syncing...' : 'Force Sync Now'}
        </Text>
      </Pressable>

      {/* Pending Items Breakdown */}
      {pendingCount > 0 ? (
        <View className="bg-zinc-900 rounded-2xl p-4 mb-4">
          <Text className="text-white font-semibold mb-3">Pending Items</Text>
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-amber-500 text-2xl font-bold">{pendingSurveys}</Text>
              <Text className="text-zinc-500 text-xs">Surveys</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-amber-500 text-2xl font-bold">{pendingPledges}</Text>
              <Text className="text-zinc-500 text-xs">Pledges</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-amber-500 text-2xl font-bold">{pendingPhotos}</Text>
              <Text className="text-zinc-500 text-xs">Photos</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Recent Activity */}
      <View className="bg-zinc-900 rounded-2xl p-4 mb-4">
        <Text className="text-white text-lg font-semibold mb-4">Recent Activity</Text>
        {MOCK_TODAY_STATS.recentActivity.map((activity) => (
          <View
            key={activity.id}
            className="flex-row items-center py-3 border-b border-zinc-800 last:border-b-0"
          >
            <View
              className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${
                activity.type === 'survey'
                  ? 'bg-blue-500/20'
                  : activity.type === 'pledge'
                  ? 'bg-purple-500/20'
                  : 'bg-green-500/20'
              }`}
            >
              {activity.type === 'survey' ? (
                <ClipboardList size={16} color="#3b82f6" />
              ) : activity.type === 'pledge' ? (
                <Camera size={16} color="#a855f7" />
              ) : (
                <Camera size={16} color="#22c55e" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-white text-sm">
                {activity.type === 'survey'
                  ? `${activity.surveyType?.charAt(0).toUpperCase()}${activity.surveyType?.slice(1)} Survey`
                  : activity.type === 'pledge'
                  ? `Pledge ${activity.email ? `- ${activity.email}` : ''}`
                  : 'Photo captured'}
              </Text>
              <Text className="text-zinc-500 text-xs">{activity.time}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Analytics Link */}
      <Pressable
        onPress={() => router.push('./analytics' as any)}
        className="flex-row items-center justify-between bg-zinc-900 rounded-2xl p-4 mb-6"
      >
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-xl bg-blue-500/20 items-center justify-center mr-3">
            <BarChart3 size={20} color="#3b82f6" />
          </View>
          <View>
            <Text className="text-white font-semibold">Detailed Analytics</Text>
            <Text className="text-zinc-500 text-sm">View charts and export data</Text>
          </View>
        </View>
        <ChevronRight size={20} color="#71717a" />
      </Pressable>

      {/* Team Info */}
      {teamCode ? (
        <View className="items-center pb-8">
          <Text className="text-zinc-600 text-sm">Team Code: {teamCode}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
