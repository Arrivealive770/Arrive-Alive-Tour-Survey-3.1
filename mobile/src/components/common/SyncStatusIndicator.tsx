// SyncStatusIndicator - visual feedback for sync status
import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useSync } from '@/providers/SyncProvider';
import { useSyncStore } from '@/lib/state/sync-store';
import { cn } from '@/lib/cn';

interface SyncStatusIndicatorProps {
  /** Show compact version (icon only) */
  compact?: boolean;
  /** Custom class names */
  className?: string;
  /** Icon size */
  iconSize?: number;
  /** Icon color when online */
  onlineColor?: string;
  /** Icon color when offline */
  offlineColor?: string;
}

export function SyncStatusIndicator({
  compact = false,
  className,
  iconSize = 20,
  onlineColor = '#10B981', // green-500
  offlineColor = '#EF4444', // red-500
}: SyncStatusIndicatorProps) {
  const { isOnline, isSyncing, pendingCount, sync } = useSync();
  const hasErrors = useSyncStore((s) => s.syncErrors.length > 0);

  const handlePress = async () => {
    if (isOnline && !isSyncing) {
      await sync();
    }
  };

  // Compact mode - just the icon with optional badge
  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        disabled={!isOnline || isSyncing}
        className={cn('relative', className)}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color={onlineColor} />
        ) : isOnline ? (
          <Wifi size={iconSize} color={onlineColor} />
        ) : (
          <WifiOff size={iconSize} color={offlineColor} />
        )}

        {/* Pending count badge */}
        {pendingCount > 0 && !isSyncing && (
          <View className="absolute -top-1 -right-1 bg-amber-500 rounded-full min-w-[16px] h-4 items-center justify-center px-1">
            <Text className="text-white text-[10px] font-bold">
              {pendingCount > 99 ? '99+' : pendingCount}
            </Text>
          </View>
        )}

        {/* Error indicator */}
        {hasErrors && !isSyncing && pendingCount === 0 ? (
          <View className="absolute -top-1 -right-1">
            <AlertCircle size={12} color="#EF4444" fill="#FEE2E2" />
          </View>
        ) : null}
      </Pressable>
    );
  }

  // Full mode - icon with status text
  return (
    <Pressable
      onPress={handlePress}
      disabled={!isOnline || isSyncing}
      className={cn(
        'flex-row items-center gap-2 px-3 py-2 rounded-lg',
        isOnline ? 'bg-green-50' : 'bg-red-50',
        className
      )}
    >
      {/* Status icon */}
      <View className="relative">
        {isSyncing ? (
          <RefreshCw
            size={iconSize}
            color={onlineColor}
            className="animate-spin"
          />
        ) : isOnline ? (
          <Wifi size={iconSize} color={onlineColor} />
        ) : (
          <WifiOff size={iconSize} color={offlineColor} />
        )}
      </View>

      {/* Status text */}
      <View className="flex-1">
        <Text
          className={cn(
            'text-sm font-medium',
            isOnline ? 'text-green-700' : 'text-red-700'
          )}
        >
          {isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}
        </Text>

        {/* Pending count or last sync */}
        {pendingCount > 0 ? (
          <Text className="text-xs text-gray-500">
            {pendingCount} item{pendingCount !== 1 ? 's' : ''} pending
          </Text>
        ) : hasErrors ? (
          <Text className="text-xs text-red-500">Sync errors occurred</Text>
        ) : null}
      </View>

      {/* Sync button (when online with pending items) */}
      {isOnline && pendingCount > 0 && !isSyncing ? (
        <View className="bg-green-100 p-1.5 rounded-full">
          <RefreshCw size={16} color={onlineColor} />
        </View>
      ) : null}

      {/* Loading indicator */}
      {isSyncing ? (
        <ActivityIndicator size="small" color={onlineColor} />
      ) : null}
    </Pressable>
  );
}

/**
 * Minimal sync status badge for headers
 */
export function SyncStatusBadge({ className }: { className?: string }) {
  const { isOnline, isSyncing, pendingCount } = useSync();

  return (
    <View
      className={cn(
        'flex-row items-center gap-1 px-2 py-1 rounded-full',
        isOnline ? 'bg-green-100' : 'bg-red-100',
        className
      )}
    >
      {isSyncing ? (
        <ActivityIndicator size={12} color={isOnline ? '#10B981' : '#EF4444'} />
      ) : isOnline ? (
        <Wifi size={12} color="#10B981" />
      ) : (
        <WifiOff size={12} color="#EF4444" />
      )}

      {pendingCount > 0 && (
        <Text
          className={cn(
            'text-[10px] font-semibold',
            isOnline ? 'text-green-700' : 'text-red-700'
          )}
        >
          {pendingCount}
        </Text>
      )}
    </View>
  );
}

export default SyncStatusIndicator;
