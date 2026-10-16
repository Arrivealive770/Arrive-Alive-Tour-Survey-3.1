/**
 * Can this device reach the desktop server right now?
 *
 * The server's address only exists inside Tailscale, so reaching it is the
 * same question as "is Tailscale on and working". NetInfo can't answer that:
 * it says "online" for any Wi-Fi or hotspot, with Tailscale switched off.
 * So this asks the server itself, and only counts a real answer from it —
 * a proxy or captive portal page that happens to return 200 doesn't count.
 *
 * One shared check runs while any screen is watching (the main menu, the
 * kiosk), every few seconds and again the moment the network changes or the
 * app comes back to the front — which is what happens when the crew switches
 * Tailscale on and returns to the app.
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';
import { BACKEND_URL } from '@/lib/api/backend-url';

/**
 * - `checking`: no answer yet since the app opened.
 * - `connected`: the server answered. Tailscale is on.
 * - `no-internet`: no Wi-Fi or data at all, so Tailscale can't work either.
 * - `no-server`: online, but the server didn't answer. Almost always
 *   Tailscale switched off; otherwise the desktop is off or asleep.
 */
export type ServerConnectionStatus = 'checking' | 'connected' | 'no-internet' | 'no-server';

const CHECK_EVERY_MS = 10_000;
// With Tailscale off the name doesn't resolve and this fails at once; the
// timeout is for a desktop that is switched off, where nothing answers.
const CHECK_TIMEOUT_MS = 5_000;

export const useServerConnectionStore = create<{ status: ServerConnectionStatus }>(() => ({
  status: 'checking',
}));

async function serverAnswers(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string } | null;
    return body?.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let inFlight: Promise<ServerConnectionStatus> | null = null;

/** Check now. Calls made while a check is running share its answer. */
export function checkServerConnection(): Promise<ServerConnectionStatus> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [answered, network] = await Promise.all([
      serverAnswers(),
      NetInfo.fetch().catch(() => null),
    ]);
    const status: ServerConnectionStatus = answered
      ? 'connected'
      : network?.isConnected === false
        ? 'no-internet'
        : 'no-server';
    useServerConnectionStore.setState({ status });
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
