import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export type OverlayType = 'marijuana' | 'alcohol' | 'distracted' | 'impaired' | 'combo' | 'default';

export interface OverlayConfig {
  type: OverlayType;
  label: string;
  color: string;
  text: string;
}

export const OVERLAY_CONFIGS: OverlayConfig[] = [
  {
    type: 'marijuana',
    label: 'Marijuana',
    color: '#22c55e',
    text: 'ARRIVE ALIVE - MARIJUANA AWARENESS',
  },
  {
    type: 'alcohol',
    label: 'Alcohol',
    color: '#3b82f6',
    text: 'ARRIVE ALIVE - ALCOHOL AWARENESS',
  },
  {
    type: 'distracted',
    label: 'Distracted',
    color: '#f97316',
    text: 'ARRIVE ALIVE - DISTRACTED DRIVING',
  },
  {
    type: 'impaired',
    label: 'Impaired',
    color: '#ef4444',
    text: 'ARRIVE ALIVE - IMPAIRED DRIVING',
  },
  {
    type: 'combo',
    label: 'Combo',
    color: '#a855f7',
    text: 'ARRIVE ALIVE - SAFE DRIVING',
  },
  {
    type: 'default',
    label: 'Default',
    color: '#71717a',
    text: 'ARRIVE ALIVE TOUR',
  },
];

export function getOverlayConfig(type: OverlayType): OverlayConfig {
  return OVERLAY_CONFIGS.find((c) => c.type === type) ?? OVERLAY_CONFIGS[5];
}

// Ensure photos directory exists
async function ensurePhotosDirectory(): Promise<string> {
  const photosDir = `${FileSystem.documentDirectory}photos/`;
  const dirInfo = await FileSystem.getInfoAsync(photosDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
  }
  return photosDir;
}

/**
 * Apply an overlay frame to a photo
 * For now, we just resize the photo and save it with a standard naming convention.
 * The overlay frame will be rendered on top in the UI.
 *
 * In a full implementation, you'd composite an actual overlay PNG on top.
 */
export async function applyOverlay(
  photoUri: string,
  overlayType: OverlayType
): Promise<string> {
  try {
    const photosDir = await ensurePhotosDirectory();
    const timestamp = Date.now();
    const filename = `photo_${overlayType}_${timestamp}.jpg`;
    const outputPath = `${photosDir}${filename}`;

    // Resize and compress the image
    const result = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 1080 } }],
      {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // Copy to permanent storage
    await FileSystem.copyAsync({
      from: result.uri,
      to: outputPath,
    });

    return outputPath;
  } catch (error) {
    console.error('[OverlayService] Failed to apply overlay:', error);
    throw error;
  }
}

/**
 * Delete a photo from local storage
 */
export async function deletePhoto(localPath: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    }
  } catch (error) {
    console.error('[OverlayService] Failed to delete photo:', error);
  }
}

/**
 * Get all photos in the photos directory
 */
export async function getStoredPhotos(): Promise<string[]> {
  try {
    const photosDir = await ensurePhotosDirectory();
    const files = await FileSystem.readDirectoryAsync(photosDir);
    return files
      .filter((f) => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'))
      .map((f) => `${photosDir}${f}`);
  } catch (error) {
    console.error('[OverlayService] Failed to get stored photos:', error);
    return [];
  }
}

/**
 * Clear all stored photos
 */
export async function clearStoredPhotos(): Promise<void> {
  try {
    const photosDir = await ensurePhotosDirectory();
    const files = await FileSystem.readDirectoryAsync(photosDir);
    await Promise.all(
      files.map((f) =>
        FileSystem.deleteAsync(`${photosDir}${f}`, { idempotent: true })
      )
    );
  } catch (error) {
    console.error('[OverlayService] Failed to clear stored photos:', error);
  }
}
