import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { api } from '@/lib/api/api';

/**
 * Keeps each event's overlay artwork on the device.
 *
 * Venues are the worst possible place to depend on a network: school gyms,
 * parking lots, fairgrounds. The camera screen used to ask the server for the
 * artwork every time it opened and hold the answer in memory only, so a phone
 * relaunched on a dead signal drew a generic badge instead of the event's
 * frame — and staff lined guests up against something the finished photo would
 * not match.
 *
 * So the artwork is downloaded to the device's own storage as soon as there is
 * service, and read from there afterwards. Once an event has been opened with a
 * signal even once, its frame keeps working with no signal at all.
 */

export interface EventOverlayArtwork {
  /** null for the built-in standard frame. */
  id: string | null;
  name: string;
  url: string;
  /** "frame" = photo sits inside the window; "overlay" = art on top of the photo. */
  mode: 'overlay' | 'frame';
  window: { x: number; y: number; w: number; h: number } | null;
  width: number | null;
  height: number | null;
  isStandard: boolean;
}

/** Bumping this invalidates every device's cache at once. */
const CACHE_VERSION = 'v1';
const keyFor = (eventId: string) => `overlay-cache:${CACHE_VERSION}:${eventId}`;

interface CachedRecord {
  /** As the server described it, still holding the remote url. */
  artwork: EventOverlayArtwork;
  /** Where the downloaded image actually lives on this device. */
  localUri: string;
  /** The remote url the file came from, so a swapped overlay is re-fetched. */
  sourceUrl: string;
  cachedAt: string;
}

const isWeb = Platform.OS === 'web';

async function overlaysDirectory(): Promise<string> {
  const dir = `${FileSystem.documentDirectory}overlays/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/** Best-effort extension so the image decoder gets a hint it understands. */
function extensionFor(url: string): string {
  const withoutQuery = url.split('?')[0] ?? '';
  const match = /\.(png|jpg|jpeg|webp|gif)$/i.exec(withoutQuery);
  return match ? `.${match[1].toLowerCase()}` : '.png';
}

async function readRecord(eventId: string): Promise<CachedRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(eventId));
    return raw ? (JSON.parse(raw) as CachedRecord) : null;
  } catch {
    return null;
  }
}

/**
 * The artwork already on this device for an event, or null.
 *
 * The file is checked, not just the record: clearing app storage removes the
 * image while leaving the bookkeeping behind, and a url pointing at a file that
 * is gone renders as an empty frame with no error anywhere.
 */
export async function readCachedOverlay(
  eventId: string
): Promise<EventOverlayArtwork | null> {
  if (isWeb) return null;

  const record = await readRecord(eventId);
  if (!record) return null;

  const info = await FileSystem.getInfoAsync(record.localUri);
  if (!info.exists) return null;

  return { ...record.artwork, url: record.localUri };
}

/**
 * Fetch this event's artwork and keep it on the device.
 *
 * Re-downloading is skipped when the same file is already here, so this is
 * cheap to call on every launch and every time the signal comes back.
 */
export async function cacheEventOverlay(
  eventId: string
): Promise<EventOverlayArtwork> {
  const artwork = await api.get<EventOverlayArtwork>(
    `/api/events/${eventId}/overlay`
  );

  // Nothing to store on web, and no FileSystem to store it with.
  if (isWeb) return artwork;

  const existing = await readRecord(eventId);
  if (existing?.sourceUrl === artwork.url) {
    const info = await FileSystem.getInfoAsync(existing.localUri);
    if (info.exists) {
      // Metadata can change without the image changing (a window being
      // adjusted in the portal), so refresh the record but keep the file.
      const record: CachedRecord = { ...existing, artwork, cachedAt: new Date().toISOString() };
      await AsyncStorage.setItem(keyFor(eventId), JSON.stringify(record));
      return { ...artwork, url: existing.localUri };
    }
  }

  const dir = await overlaysDirectory();
  const localUri = `${dir}${eventId}${extensionFor(artwork.url)}`;

  // Download beside the target and swap in on success, so a download that
  // dies halfway cannot replace good artwork with a truncated file.
  const tempUri = `${localUri}.downloading`;
  await FileSystem.deleteAsync(tempUri, { idempotent: true });

  const result = await FileSystem.downloadAsync(artwork.url, tempUri);
  if (result.status !== 200) {
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
    throw new Error(`Overlay download failed (${result.status})`);
  }

  await FileSystem.deleteAsync(localUri, { idempotent: true });
  await FileSystem.moveAsync({ from: tempUri, to: localUri });

  const record: CachedRecord = {
    artwork,
    localUri,
    sourceUrl: artwork.url,
    cachedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(keyFor(eventId), JSON.stringify(record));

  console.log(`[OverlayCache] Stored "${artwork.name}" for event ${eventId}`);
  return { ...artwork, url: localUri };
}

/**
 * The artwork to draw right now: the server's answer when it can be reached,
 * otherwise whatever this device already has.
 *
 * Network first so an overlay swapped in the portal reaches the phones, but a
 * failure here is expected rather than exceptional — it only means the venue
 * has no signal, which is precisely what the cache is for.
 */
export async function loadEventOverlay(
  eventId: string
): Promise<EventOverlayArtwork> {
  try {
    return await cacheEventOverlay(eventId);
  } catch (error) {
    const cached = await readCachedOverlay(eventId);
    if (cached) {
      console.log(`[OverlayCache] Offline — using stored artwork for ${eventId}`);
      return cached;
    }
    throw error;
  }
}

/** Drop an event's stored artwork. Used when a device leaves an event. */
export async function forgetCachedOverlay(eventId: string): Promise<void> {
  if (isWeb) return;
  try {
    const record = await readRecord(eventId);
    if (record) {
      await FileSystem.deleteAsync(record.localUri, { idempotent: true });
    }
    await AsyncStorage.removeItem(keyFor(eventId));
  } catch (error) {
    console.error('[OverlayCache] Failed to forget overlay:', error);
  }
}
