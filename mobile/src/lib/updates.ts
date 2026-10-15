/**
 * Build stamp for the menu screen, e.g. "v1.0.0 · 3f9a2c1 · preview".
 *
 * Nobody can tell what a tablet is running without one. "Is it still broken,
 * or did it never get the fix?" and "is this the test app or the real one?"
 * are both answered by reading this line off the screen.
 *
 * Read-only on purpose: it looks at what expo-updates already knows and never
 * checks, downloads or restarts anything. Every lookup is guarded, because a
 * build stamp must never be the reason the menu fails to render.
 */

import * as Updates from 'expo-updates';

/** Short, readable id for an update — enough to tell two bundles apart. */
function shortId(id: string | null | undefined): string {
  if (!id) return 'built-in';
  return id.replace(/-/g, '').slice(0, 7);
}

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

/** True on the test app, so it can't be mistaken for a field tablet. */
export function isTestingBuild(): boolean {
  try {
    return Updates.channel === 'testing';
  } catch {
    return false;
  }
}
