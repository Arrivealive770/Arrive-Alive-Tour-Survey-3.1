import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useServerConnection } from '@/lib/connection/server-connection';
import { ConnectionStatusCard } from '@/components/common/ConnectionStatusCard';
import { cn } from '@/lib/cn';

// Long enough that nobody skips the warning without meaning to.
const OFFLINE_OVERRIDE_HOLD_MS = 3000;

/**
 * Tailscale has to be on for anything to reach the office live. A crew that
 * forgets finds out at the end of the day, so starting a station without it
 * stops at a warning. Everything still saves on the device either way, so the
 * warning can be held past for a venue with no signal at all.
 *
 * `guard(go)` runs `go` straight away when connected; otherwise it shows the
 * warning, and runs `go` by itself once the crew switches Tailscale on and
 * comes back. Render `gate` once on the screen.
 */
export function useConnectionGate() {
  const connection = useServerConnection();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [holding, setHolding] = useState<boolean>(false);

  const guard = useCallback(
    (go: () => void) => {
      if (connection === 'connected') {
        go();
      } else {
        // Wrapped: a function handed to setState is treated as an updater.
        setPending(() => go);
      }
    },
    [connection]
  );

  useEffect(() => {
    if (pending && connection === 'connected') {
      setPending(null);
      pending();
    }
  }, [pending, connection]);

  const handleOverride = () => {
    const go = pending;
    setPending(null);
    setHolding(false);
    go?.();
  };

  const gate = (
    <Modal
      visible={pending !== null}
      animationType="fade"
      transparent
      onRequestClose={() => setPending(null)}
    >
      <View className="flex-1 bg-black/80 items-center justify-center px-8">
        <View className="w-full max-w-md bg-zinc-900 rounded-2xl p-6">
          <Text className="text-2xl font-bold text-white mb-2">Turn on Tailscale first</Text>
          <Text className="text-zinc-400 mb-5">
            This device can&apos;t reach the office. Fix the connection and it will carry on by
            itself.
          </Text>

          <ConnectionStatusCard status={connection} className="mb-5" />

          <Pressable
            testID="connection-cancel"
            onPress={() => setPending(null)}
            className="h-14 items-center justify-center bg-zinc-800 rounded-xl active:bg-zinc-700 mb-3"
          >
            <Text className="text-white font-semibold text-lg">Go Back</Text>
          </Pressable>
          <Pressable
            testID="connection-override"
            onPressIn={() => setHolding(true)}
            onPressOut={() => setHolding(false)}
            onLongPress={handleOverride}
            delayLongPress={OFFLINE_OVERRIDE_HOLD_MS}
            className={cn(
              'items-center justify-center py-3 rounded-xl border',
              holding ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-800'
            )}
          >
            <Text className={cn('font-semibold', holding ? 'text-amber-400' : 'text-zinc-500')}>
              {holding ? 'Keep holding…' : 'Hold 3 seconds to start without it'}
            </Text>
            <Text className="text-zinc-600 text-xs mt-1">
              Surveys save on this device and send once it&apos;s connected
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  return { connection, guard, gate };
}
