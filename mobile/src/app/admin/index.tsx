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
import { useQuery } from '@tanstack/react-query';
import { SummaryCard } from '@/components/admin/SummaryCard';
import { PieChart, SURVEY_TYPE_COLORS } from '@/components/admin/AnalyticsChart';
import { useSync } from '@/providers/SyncProvider';
import { useSyncStore } from '@/lib/state/sync-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { getDatabaseSafe } from '@/lib/db/database';
import type { ActivityItem } from '@/lib/db/schema';
import { SURVEY_TYPES } from '@/lib/api/types';

const SURVEY_TYPE_LABELS: Record<string, string> = {
  marijuana: 'Marijuana',
  alcohol: 'Alcohol',
  distracted: 'Distracted',
  impaired: 'Impaired',
  combo: 'Combo',
};

/** "2026-08-20T14:03:00Z" -> "12 min ago" */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { isOnline, isSyncing, pendingCount, sync, lastSyncAt } = useSync();
  const { db, isReady } = useDatabase();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pendingSurveys = useSyncStore((s) => s.pendingSurveys);
  const pendingPhotos = useSyncStore((s) => s.pendingPhotos);

  const teamCode = useDeviceStore((s) => s.teamCode);

  // Real numbers, read from the local queues so they stay correct offline.
  // Resolved via getDatabaseSafe() rather than the context value so the query
  // function has no external dependencies.
  const { data: dashboardData, refetch: refetchDashboard } = useQuery({
    queryKey: ['admin', 'today-stats', isReady],
    enabled: isReady,
    queryFn: async () => {
      const database = getDatabaseSafe();
      if (!database) return null;
      const [stats, activity] = await Promise.all([
        database.getTodayStats(),
        database.getRecentActivity(5),
      ]);
      return { stats, activity };
    },
  });

  const todayStats = dashboardData?.stats;
  // Pledges are deliberately left out of the admin views — staff should see how
  // the surveys are going, not how many people pledged or were emailed.
  const recentActivity: ActivityItem[] = (dashboardData?.activity ?? []).filter(
    (item) => item.type !== 'pledge'
  );

  const surveysToday = todayStats?.surveys ?? 0;

  const surveysByType = (todayStats?.surveysByType ?? []).map((row) => ({
    label: SURVEY_TYPE_LABELS[row.surveyTypeSlug] ?? row.surveyTypeSlug,
    value: row.count,
    color:
      SURVEY_TYPE_COLORS[row.surveyTypeSlug as keyof typeof SURVEY_TYPE_COLORS] ?? '#71717a',
  }));

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchDashboard();
    setIsRefreshing(false);
  }, [refetchDashboard]);

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
      <View className="flex-row mb-6">
        <SummaryCard
          icon={ClipboardList}
          label="Surveys Today"
          value={surveysToday}
          accentColor="#3b82f6"
          className="flex-1 mr-2"
        />
        <SummaryCard
          icon={RefreshCw}
          label="Pending Sync"
          value={pendingCount}
          accentColor={pendingCount > 0 ? '#f59e0b' : '#22c55e'}
          className="flex-1 ml-2"
        />
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
        <PieChart data={surveysByType} />
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
              <Text className="text-amber-500 text-2xl font-bold">{pendingPhotos}</Text>
              <Text className="text-zinc-500 text-xs">Photos</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Recent Activity */}
      <View className="bg-zinc-900 rounded-2xl p-4 mb-4">
        <Text className="text-white text-lg font-semibold mb-4">Recent Activity</Text>
        {recentActivity.length === 0 ? (
          <Text className="text-zinc-500 text-sm">No activity on this device yet.</Text>
        ) : (
          recentActivity.map((activity) => (
            <View
              key={activity.id}
              className="flex-row items-center py-3 border-b border-zinc-800 last:border-b-0"
            >
              <View
                className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${
                  activity.type === 'survey' ? 'bg-blue-500/20' : 'bg-green-500/20'
                }`}
              >
                {activity.type === 'survey' ? (
                  <ClipboardList size={16} color="#3b82f6" />
                ) : (
                  <Camera size={16} color="#22c55e" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-white text-sm">
                  {activity.type === 'survey'
                    ? `${SURVEY_TYPE_LABELS[activity.label ?? ''] ?? activity.label} Survey`
                    : 'Photo captured'}
                </Text>
                <Text className="text-zinc-500 text-xs">{timeAgo(activity.at)}</Text>
              </View>
            </View>
          ))
        )}
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
