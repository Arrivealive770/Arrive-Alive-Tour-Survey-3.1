/**
 * Can this device reach the desktop server right now — or its backup?
 *
 * The server's address only exists inside Tailscale, so reaching it is the
 * same question as "is Tailscale on and working". NetInfo can't answer that:
 * it says "online" for any Wi-Fi or hotspot, with Tailscale switched off.
 * So this asks the server itself, and only counts a real answer from it —
 * a proxy or captive portal page that happens to return 200 doesn't count.
 *
 * It also decides which server the whole app talks to. The desktop always
 * wins when it answers. When it doesn't, the backup computer is asked whether
 * it has taken over; only then does the app switch to it. A backup that is
 * merely on standby is never used — it would throw the data away on its next
 * copy. The moment the desktop answers again the app switches back, and the
 * backup hands over what it collected by itself.
 *
 * One shared check runs for as long as the app is open (SyncProvider keeps
 * it going), every few seconds and again the moment the network changes or
 * the app comes back to the front — which is what happens when the crew
 * switches Tailscale on and returns to the app.
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';
import {
  BACKUP_BACKEND_URL,
  MAIN_BACKEND_URL,
  setActiveBackendUrl,
} from '@/lib/api/backend-url';

/**
 * - `checking`: no answer yet since the app opened.
 * - `connected`: the server (or the backup, see `onBackup`) answered. Tailscale is on.
 * - `no-internet`: no Wi-Fi or data at all, so Tailscale can't work either.
 * - `no-server`: online, but the server didn't answer. Almost always
 *   Tailscale switched off; otherwise the desktop is off or asleep.
 */
export type ServerConnectionStatus = 'checking' | 'connected' | 'no-internet' | 'no-server';

const CHECK_EVERY_MS = 10_000;
// With Tailscale off the name doesn't resolve and this fails at once; the
// timeout is for a desktop that is switched off, where nothing answers.
const CHECK_TIMEOUT_MS = 5_000;

export const useServerConnectionStore = create<{
  status: ServerConnectionStatus;
  /** Connected, but to the backup computer because the desktop is down. */
  onBackup: boolean;
}>(() => ({
  status: 'checking',
  onBackup: false,
}));

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mainAnswers(): Promise<boolean> {
  const body = (await getJson(`${MAIN_BACKEND_URL}/health`)) as { status?: string } | null;
  return body?.status === 'ok';
}

/** Has the backup computer taken over? Standby, draining or no answer all mean no. */
async function backupInCharge(): Promise<boolean> {
  if (!BACKUP_BACKEND_URL) return false;
  const body = (await getJson(`${BACKUP_BACKEND_URL}/api/failover/status`)) as {
    data?: { role?: string; state?: string };
  } | null;
  return body?.data?.role === 'backup' && body.data.state === 'active';
}

let inFlight: Promise<ServerConnectionStatus> | null = null;

/** Check now. Calls made while a check is running share its answer. */
export function checkServerConnection(): Promise<ServerConnectionStatus> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [mainUp, network] = await Promise.all([
      mainAnswers(),
      NetInfo.fetch().catch(() => null),
    ]);
    const onBackup = !mainUp && (await backupInCharge());

    // Back to the desktop whenever nothing is answering, so the next check
    // and every queued retry start from the normal address.
    setActiveBackendUrl(onBackup ? BACKUP_BACKEND_URL : MAIN_BACKEND_URL);

    const status: ServerConnectionStatus =
      mainUp || onBackup
        ? 'connected'
        : network?.isConnected === false
          ? 'no-internet'
          : 'no-server';
    useServerConnectionStore.setState({ status, onBackup });
    return status;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

let watchers = 0;
let stopWatching: (() => void) | null = null;

function startWatching(): () => void {
  checkServerConnection();
  const timer = setInterval(checkServerConnection, CHECK_EVERY_MS);
  const unsubscribeNetwork = NetInfo.addEventListener(() => {
    checkServerConnection();
  });
  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') checkServerConnection();
  });

  return () => {
    clearInterval(timer);
    unsubscribeNetwork();
    appState.remove();
  };
}

/** Current connection status, kept fresh for as long as the caller is mounted. */
export function useServerConnection(): ServerConnectionStatus {
  useEffect(() => {
    watchers += 1;
    if (watchers === 1) stopWatching = startWatching();

    return () => {
      watchers -= 1;
      if (watchers === 0) {
        stopWatching?.();
        stopWatching = null;
      }
    };
  }, []);

  return useServerConnectionStore((s) => s.status);
}
