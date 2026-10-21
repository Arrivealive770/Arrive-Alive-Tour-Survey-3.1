import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { ShieldCheck, ShieldOff, WifiOff } from 'lucide-react-native';
import {
  checkServerConnection,
  useServerConnectionStore,
  type ServerConnectionStatus,
} from '@/lib/connection/server-connection';
import { cn } from '@/lib/cn';

const COPY: Record<ServerConnectionStatus, { title: string; detail: string }> = {
  checking: {
    title: 'Checking connection…',
    detail: 'Looking for the office server.',
  },
  connected: {
    title: 'Connected to Tailscale',
    detail: 'Surveys and photos go straight to the office.',
  },
  'no-server': {
    title: 'Not connected to Tailscale',
    detail:
      "Open the Tailscale app and switch it on. If it's already on, the office computer may be off or asleep.",
  },
  'no-internet': {
    title: 'No internet',
    detail: 'Connect to Wi-Fi or the hotspot first, then make sure Tailscale is on.',
  },
};

// The desktop is down and the backup computer has taken over. Still green:
// nothing for the crew to do, everything still goes through.
const ON_BACKUP_COPY = {
  title: 'Connected to the backup computer',
  detail: 'The office computer is down, so the backup has taken over. Surveys and photos still go through.',
};

interface ConnectionStatusCardProps {
  status: ServerConnectionStatus;
  className?: string;
}

/** Green when the server answers, red when it doesn't. Tap to check again. */
export function ConnectionStatusCard({ status, className }: ConnectionStatusCardProps) {
  const [rechecking, setRechecking] = useState<boolean>(false);
  const onBackup = useServerConnectionStore((s) => s.onBackup);
  const connected = status === 'connected';
  const offline = status === 'no-server' || status === 'no-internet';
  const busy = status === 'checking' || rechecking;
  const { title, detail } = connected && onBackup ? ON_BACKUP_COPY : COPY[status];

  const handlePress = async () => {
    if (busy) return;
    setRechecking(true);
    await checkServerConnection();
    setRechecking(false);
  };

  return (
    <Pressable
      testID="connection-status"
      onPress={handlePress}
      className={cn(
        'flex-row items-center rounded-2xl p-4 border',
        connected && 'bg-green-500/10 border-green-500/40',
        offline && 'bg-red-600/15 border-red-500/60',
        !connected && !offline && 'bg-zinc-900 border-zinc-800',
        className
      )}
    >
      <View
        className={cn(
          'w-11 h-11 rounded-full items-center justify-center mr-4',
          connected ? 'bg-green-500/20' : offline ? 'bg-red-500/20' : 'bg-zinc-800'
        )}
      >
        {busy ? (
          <ActivityIndicator size="small" color={offline ? '#f87171' : '#a1a1aa'} />
        ) : connected ? (
          <ShieldCheck size={24} color="#22c55e" />
        ) : status === 'no-internet' ? (
          <WifiOff size={24} color="#f87171" />
        ) : (
          <ShieldOff size={24} color="#f87171" />
        )}
      </View>
      <View className="flex-1">
        <Text
          className={cn(
            'text-lg font-bold',
            connected ? 'text-green-400' : offline ? 'text-red-400' : 'text-white'
          )}
        >
          {title}
        </Text>
        <Text className={cn('text-sm mt-0.5', offline ? 'text-red-200/80' : 'text-zinc-400')}>
          {detail}
        </Text>
        {offline ? (
          <Text className="text-red-300 text-sm font-semibold mt-2">
            {rechecking ? 'Checking…' : 'Tap to check again'}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
