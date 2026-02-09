import { View, Text, Pressable } from 'react-native';
import { Tablet, Smartphone, RefreshCw, Clock, AlertCircle } from 'lucide-react-native';
import { cn } from '@/lib/cn';

export interface DeviceStatusCardProps {
  id: string;
  name: string;
  type: 'tablet' | 'phone';
  lastSyncTime: string | null;
  pendingCount: number;
  isOnline: boolean;
  onPress?: () => void;
}

export function DeviceStatusCard({
  name,
  type,
  lastSyncTime,
  pendingCount,
  isOnline,
  onPress,
}: DeviceStatusCardProps) {
  const DeviceIcon = type === 'tablet' ? Tablet : Smartphone;

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';

    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <Pressable
      onPress={onPress}
      className="bg-zinc-900 rounded-2xl p-4 mb-3 border border-zinc-800 active:bg-zinc-800"
    >
      <View className="flex-row items-center">
        {/* Device Icon */}
        <View
          className={cn(
            'w-12 h-12 rounded-xl items-center justify-center mr-3',
            isOnline ? 'bg-green-500/20' : 'bg-zinc-800'
          )}
        >
          <DeviceIcon size={24} color={isOnline ? '#22c55e' : '#71717a'} />
        </View>

        {/* Device Info */}
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-white text-base font-semibold">{name}</Text>
            {/* Online indicator */}
            <View
              className={cn(
                'w-2 h-2 rounded-full ml-2',
                isOnline ? 'bg-green-500' : 'bg-red-500'
              )}
            />
          </View>

          <View className="flex-row items-center mt-1">
            <Clock size={12} color="#71717a" />
            <Text className="text-zinc-500 text-sm ml-1">
              Synced {formatRelativeTime(lastSyncTime)}
            </Text>
          </View>
        </View>

        {/* Pending Count */}
        {pendingCount > 0 ? (
          <View className="bg-amber-500/20 px-3 py-1.5 rounded-lg flex-row items-center">
            <RefreshCw size={14} color="#f59e0b" />
            <Text className="text-amber-500 font-semibold ml-1">{pendingCount}</Text>
          </View>
        ) : (
          <View className="bg-zinc-800 px-3 py-1.5 rounded-lg">
            <Text className="text-zinc-500 text-sm">Synced</Text>
          </View>
        )}
      </View>

      {/* Warning if offline with pending items */}
      {!isOnline && pendingCount > 0 ? (
        <View className="flex-row items-center mt-3 pt-3 border-t border-zinc-800">
          <AlertCircle size={14} color="#ef4444" />
          <Text className="text-red-500 text-sm ml-2">
            {pendingCount} item{pendingCount > 1 ? 's' : ''} waiting to sync
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
