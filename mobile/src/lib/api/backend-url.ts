/**
 * Where the app looks for the desktop server.
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

/** Trailing slashes are stripped so `${BACKEND_URL}/api/x` can't become `//api/x`. */
export const BACKEND_URL =
  (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').trim().replace(/\/+$/, '') ||
  DESKTOP_BACKEND_URL;
