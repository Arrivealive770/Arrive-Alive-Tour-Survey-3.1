/**
 * Where the app looks for the desktop server — and its backup.
 *
 * `EXPO_PUBLIC_BACKEND_URL` is not read at runtime — Expo replaces it with a
 * literal while the bundle is built. That is fine for APKs, because
 * `eas build` reads the `env` block of the profile in mobile/eas.json. It is
 * NOT fine for over-the-air updates: `eas update` ignores that `env` block
 * (it only falls back to a local .env file, and the desktop has none for the
 * mobile app). A publish from a machine without the variable set therefore
 * bakes in `undefined`, every request becomes `undefined/api/...`, and each
 * tablet that takes the update loses the server with no way to be told the
 * address afterwards.
 *
 * So the address is compiled in as a fallback. The env var still wins when it
 * is present, which keeps the Vibecode preview and any future host working
 * without an edit here.
 *
 * If the desktop's Tailscale name ever changes, change it in BOTH places:
 * this constant and the `env` blocks in mobile/eas.json.
 */
const DESKTOP_BACKEND_URL = 'https://arrivealive.tail04a318.ts.net';

/**
 * The backup computer (desktop/README.md, "Backup computer"). It copies the
 * desktop every minute and takes over when the desktop stops answering; the
 * app follows it there by itself (lib/connection/server-connection.ts).
 *
 * Only the live app gets the compiled-in fallback. The test app talks to the
 * test server on :8443, and must never fail over onto the crews' backup.
 */
const DESKTOP_BACKUP_URL = 'https://arrivealive-backup.tail04a318.ts.net';

const trim = (url: string | undefined) => (url ?? '').trim().replace(/\/+$/, '');

/** The desktop. Trailing slashes are stripped so `${url}/api/x` can't become `//api/x`. */
export const MAIN_BACKEND_URL = trim(process.env.EXPO_PUBLIC_BACKEND_URL) || DESKTOP_BACKEND_URL;

/** The backup computer, or '' when this build has none. */
export const BACKUP_BACKEND_URL =
  trim(process.env.EXPO_PUBLIC_BACKUP_BACKEND_URL) ||
  (MAIN_BACKEND_URL === DESKTOP_BACKEND_URL ? DESKTOP_BACKUP_URL : '');

let activeBackendUrl = MAIN_BACKEND_URL;

/**
 * The server to talk to right now: the desktop, unless it is down and the
 * backup has taken over. Read it at the moment of each request — never copy it
 * into a constant, or that code keeps talking to a dead server.
 */
export function getBackendUrl(): string {
  return activeBackendUrl;
}

/** Only server-connection.ts decides this. */
export function setActiveBackendUrl(url: string): void {
  if (url !== activeBackendUrl) {
    console.log(`[Server] Now using ${url === MAIN_BACKEND_URL ? 'the office server' : 'the BACKUP computer'}: ${url}`);
  }
  activeBackendUrl = url;
}

export function isUsingBackupServer(): boolean {
  return activeBackendUrl !== MAIN_BACKEND_URL;
}
