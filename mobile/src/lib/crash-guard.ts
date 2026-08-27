/**
 * Catches the crashes nothing else can, and remembers them.
 *
 * There were already two safety nets and neither covered the case that keeps
 * closing the tablets:
 *
 *   index.ts        catches a failure while modules are still loading
 *   ErrorBoundary   catches a throw while a screen is rendering
 *
 * Neither sees an error thrown from a timer, an event listener, or a promise
 * nobody awaited. React Native's default behaviour for one of those in a
 * release build is to kill the process — no message, no screen, the app just
 * closes a second after opening. Which is exactly what the crews described,
 * and exactly why there was nothing to read afterwards.
 *
 * So: keep the app alive, and write down what happened. A kiosk mid-event is
 * better off running with one broken background job than vanishing, and the
 * saved record is the difference between "it crashes" and knowing the reason.
 *
 * The record survives the app closing, so even if something later kills the
 * process anyway, the next launch can still show what went wrong.
 */

const STORAGE_KEY = 'last-crash';

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
}

let installed = false;

/** Keep the most recent crash in memory too, so the UI can show it instantly. */
let lastCrash: CrashRecord | null = null;

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
 * Install the handler. Call this as early as possible — before the router,
 * before any provider — so it is already in place when something throws.
 */
/**
 * Write down a crash. Used by the global handler below, and by the router's
 * error screens, so a render crash on a tablet is still readable on the menu
 * screen after someone restarts the app.
 */
export function recordCrash(error: unknown, fatal = false): CrashRecord {
  const { message, stack } = describe(error);

  const record: CrashRecord = {
    message,
    stack,
    when: new Date().toISOString(),
    fatal,
  };
  lastCrash = record;

  // Best effort — if storage is what broke, there is nothing more to do.
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(record)).catch(() => {});
  } catch {
    // Keep the in-memory copy and move on.
  }

  return record;
}

export function installCrashGuard(): void {
  if (installed) return;
  installed = true;

  // ErrorUtils is a React Native global with no type declaration.
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previousHandler = errorUtils.getGlobalHandler?.();

  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    const record = recordCrash(error, !!isFatal);

    console.error('[CrashGuard] Caught an uncaught error:', record.message, record.stack);

    // In development, hand it on so the usual red screen still appears.
    // In production we deliberately stop here: calling the default handler
    // is what closes the app, and a kiosk that stays up is worth more than
    // a clean exit nobody is around to see.
    if (__DEV__ && previousHandler) {
      previousHandler(error, isFatal);
    }
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
