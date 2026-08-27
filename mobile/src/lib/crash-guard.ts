/**
 * Catches the crashes nothing else can, remembers them, and gets the tablet
 * back on its feet.
 *
 * There were already two safety nets and neither covered the case that kept
 * closing the tablets:
 *
 *   index.ts        catches a failure while modules are still loading
 *   ErrorBoundary   catches a throw while a screen is rendering
 *
 * Neither sees an error thrown from a timer, an event listener, or a promise
 * nobody awaited. React Native's default behaviour for one of those in a
 * release build is to kill the process — no message, no screen, the app just
 * closes. Which is what the crews described, and why there was nothing to read
 * afterwards.
 *
 * The first attempt at this simply swallowed everything and returned, on the
 * theory that a kiosk mid-event is better off limping than vanishing. That was
 * wrong, and it is what produced the grey screen.
 *
 * A *fatal* error means the JS context was already torn in the middle of doing
 * something — very often React's own commit phase. Declining to let the process
 * die does not put any of that back. React is left half-committed and never
 * renders again, so the app sits there alive with a dead UI: a grey rectangle,
 * no error screen, nothing to tap. Worse than closing, because closing at least
 * tells you something happened.
 *
 * So the rule is split by severity:
 *
 *   not fatal   swallow it. A background job failed; the app is fine. This is
 *               the case the original guard was actually right about.
 *   fatal       write it down, then reload the JS bundle. A clean restart puts
 *               the crew back on the menu in about two seconds with the record
 *               waiting on screen, instead of a brick or a silent exit.
 *
 * Auto-reload is deliberately refused during the first 20 seconds of a run. A
 * crash that happens at boot would otherwise reload into the same crash for
 * ever. In that case the error is handed to the default handler — the app
 * closes, but the record is saved, and the next launch can show it.
 */

const STORAGE_KEY = 'last-crash';

/**
 * How long the app must have been up before a fatal is treated as worth
 * restarting for. Below this we assume the crash is at boot and a reload would
 * just loop.
 */
const MIN_UPTIME_BEFORE_RELOAD_MS = 20_000;

/** Longest we will wait for the crash record to reach disk before reloading. */
const WRITE_FLUSH_TIMEOUT_MS = 1_500;

const startedAt = Date.now();

/**
 * Storage is loaded on demand rather than imported at the top of this file.
 *
 * index.ts loads this module first of all — ahead of Reanimated, which is
 * documented as needing to come before anything else in the entry file.
 * Dragging a native module in front of it, at boot, for something only needed
 * at the moment a crash is written down, is not a trade worth making. If the
 * import fails the record simply stays in memory for this run.
 */
function storage(): {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
} | null {
  try {
    return require('@react-native-async-storage/async-storage').default ?? null;
  } catch {
    return null;
  }
}

export interface CrashRecord {
  message: string;
  stack: string;
  /** ISO timestamp of when it happened. */
  when: string;
  /** Whether React Native considered it fatal (would have closed the app). */
  fatal: boolean;
  /** Set when the guard restarted the app rather than letting it die. */
  restarted?: boolean;
}

let installed = false;

/** Keep the most recent crash in memory too, so the UI can show it instantly. */
let lastCrash: CrashRecord | null = null;

/**
 * Resolves once the most recent record has reached disk. Awaited before a
 * reload, because reloading throws away anything still in flight — and the
 * record is the entire point.
 */
let pendingWrite: Promise<void> = Promise.resolve();

/** Guards against a second fatal arriving while the reload is being set up. */
let reloading = false;

function describe(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) {
    return {
      message: `${error.name}: ${error.message}`,
      stack: error.stack ?? '(no stack)',
    };
  }
  return { message: String(error), stack: '(not an Error object)' };
}

/**
 * Write down a crash. Used by the global handler below, and by the router's
 * error screens, so a render crash on a tablet is still readable on the menu
 * screen after someone restarts the app.
 */
export function recordCrash(error: unknown, fatal = false, restarted = false): CrashRecord {
  const { message, stack } = describe(error);

  const record: CrashRecord = {
    message,
    stack,
    when: new Date().toISOString(),
    fatal,
    restarted,
  };
  lastCrash = record;

  // Best effort — if storage is what broke, there is nothing more to do.
  try {
    const write = storage()?.setItem(STORAGE_KEY, JSON.stringify(record));
    pendingWrite = write ? write.catch(() => {}) : Promise.resolve();
  } catch {
    // Keep the in-memory copy and move on.
    pendingWrite = Promise.resolve();
  }

  return record;
}

/**
 * Restart into a fresh JS bundle. Returns false if that isn't possible here —
 * in which case the caller must let the default handler take over, since the
 * one thing we must not do is return to a broken context.
 */
function tryReload(): boolean {
  try {
    const Updates = require('expo-updates');
    if (typeof Updates?.reloadAsync !== 'function') return false;

    // Give the record a moment to land, but never block on it indefinitely.
    Promise.race([
      pendingWrite,
      new Promise((resolve) => setTimeout(resolve, WRITE_FLUSH_TIMEOUT_MS)),
    ])
      .then(() => Updates.reloadAsync())
      .catch((err: unknown) => {
        console.error('[CrashGuard] Could not restart the app:', err);
      });

    return true;
  } catch {
    return false;
  }
}

export function installCrashGuard(): void {
  if (installed) return;
  installed = true;

  // ErrorUtils is a React Native global with no type declaration.
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previousHandler = errorUtils.getGlobalHandler?.();

  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    const fatal = !!isFatal;

    // In development, hand everything on so the usual red screen still appears.
    if (__DEV__) {
      recordCrash(error, fatal);
      previousHandler?.(error, isFatal);
      return;
    }

    if (!fatal) {
      // A background job blew up. The app itself is intact, so keep going —
      // this is the case worth surviving, and the menu will show the record.
      const record = recordCrash(error, false);
      console.error('[CrashGuard] Caught a non-fatal error:', record.message, record.stack);
      return;
    }

    if (reloading) return;

    const uptimeMs = Date.now() - startedAt;
    const canRestart = uptimeMs >= MIN_UPTIME_BEFORE_RELOAD_MS;
    const record = recordCrash(error, true, canRestart);

    console.error(
      `[CrashGuard] Fatal after ${Math.round(uptimeMs / 1000)}s:`,
      record.message,
      record.stack
    );

    if (canRestart) {
      reloading = true;
      if (tryReload()) return;
      reloading = false;
    }

    // Either too early in the run to risk a restart loop, or there is no way to
    // reload. Let it close properly rather than sitting on a dead screen — the
    // record is saved and the next launch will show it.
    previousHandler?.(error, isFatal);
  });
}

interface ErrorUtilsShape {
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
}

/** The crash from this run, if there was one. */
export function getCrashInMemory(): CrashRecord | null {
  return lastCrash;
}

/** The last crash recorded on this device, including from a previous run. */
export async function getLastCrash(): Promise<CrashRecord | null> {
  if (lastCrash) return lastCrash;
  try {
    const raw = await storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CrashRecord;
  } catch {
    return null;
  }
}

/** Clear it once someone has read it, so old news doesn't linger on screen. */
export async function clearLastCrash(): Promise<void> {
  lastCrash = null;
  try {
    await storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do; the record is gone from memory either way.
  }
}
