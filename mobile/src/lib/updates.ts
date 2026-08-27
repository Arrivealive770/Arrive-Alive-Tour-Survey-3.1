/**
 * Over-the-air updates, made visible and made to actually land.
 *
 * Two problems this file exists for, both learned the hard way:
 *
 * 1. A crash-on-open build can never heal itself. By default expo-updates
 *    downloads a new bundle in the background and only swaps it in on the
 *    NEXT launch. If the app closes a second after opening, the download is
 *    killed halfway every single time and the tablet is stranded on the
 *    broken bundle forever. So we fetch and reload immediately at startup
 *    instead of waiting for a next launch that may never get far enough.
 *
 * 2. Nobody could tell what a tablet was running. "Is it still crashing, or
 *    did it never get the fix?" is unanswerable without a build stamp you can
 *    read off the screen, so {@link updateStamp} puts one on the menu.
 *
 * Everything here is defensive: an update helper must never be the reason the
 * app fails to start.
 */

import { useEffect, useRef, useState } from 'react';
import * as Updates from 'expo-updates';

/** Short, readable id for an update — enough to tell two bundles apart. */
function shortId(id: string | null | undefined): string {
  if (!id) return 'built-in';
  return id.replace(/-/g, '').slice(0, 7);
}

/**
 * What this tablet is running, e.g. "v1.0.0 · 3f9a2c1 · production".
 * Read this off the screen to know whether a tablet has a given fix.
 */
export function updateStamp(): string {
  const parts: string[] = [];

  try {
    parts.push(`v${Updates.runtimeVersion ?? '1.0.0'}`);
  } catch {
    parts.push('v?');
  }

  try {
    parts.push(Updates.isEmbeddedLaunch ? 'built-in' : shortId(Updates.updateId));
  } catch {
    parts.push('built-in');
  }

  try {
    if (Updates.channel) parts.push(Updates.channel);
  } catch {
    // Not fatal — the channel is a nicety.
  }

  return parts.join(' · ');
}

export type UpdateCheckResult =
  | { status: 'disabled' }
  | { status: 'up-to-date' }
  | { status: 'installing' }
  | { status: 'error'; message: string };

/**
 * Fetch a waiting update and restart into it right now.
 *
 * Deliberately does NOT wait for a later launch: on a tablet that is crashing,
 * later never comes.
 */
export async function fetchAndApplyUpdate(): Promise<UpdateCheckResult> {
  if (__DEV__ || !Updates.isEnabled) return { status: 'disabled' };

  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return { status: 'up-to-date' };

    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return { status: 'up-to-date' };

    // From here the app restarts into the new bundle; nothing after this runs.
    await Updates.reloadAsync();
    return { status: 'installing' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not reach the update server';
    console.warn('[Updates] Update check failed:', message);
    return { status: 'error', message };
  }
}

/**
 * Runs one update check per app start, in the background.
 *
 * Returns true while an update is being downloaded, so the caller can say so
 * on screen instead of the tablet appearing to freeze before it restarts.
 *
 * There is no reload loop to worry about: after the restart the new bundle is
 * the newest one, so the next check finds nothing available.
 */
export function useStartupUpdate(): boolean {
  const [checking, setChecking] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (__DEV__ || !Updates.isEnabled) return;

    let cancelled = false;
    setChecking(true);

    fetchAndApplyUpdate()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return checking;
}
