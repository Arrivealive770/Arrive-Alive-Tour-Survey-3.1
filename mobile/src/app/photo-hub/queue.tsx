import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Upload, Trash2, Wifi, WifiOff, Image as ImageIcon } from 'lucide-react-native';
import NetInfo from '@react-native-community/netinfo';
import { PhotoQueueItemCard, QRCodeDisplay } from '@/components/photo-hub';
import { useDatabase } from '@/providers/DatabaseProvider';
import { useSyncStore } from '@/lib/state/sync-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { deletePhoto, clearStoredPhotos } from '@/lib/overlays/overlay-service';
import type { PhotoQueueItem } from '@/lib/db/schema';
import { BACKEND_URL } from '@/lib/api/backend-url';

export default function PhotoQueueScreen() {
  const { db, isReady } = useDatabase();
  const setOnlineStatus = useSyncStore((s) => s.setOnlineStatus);
  const isOnline = useSyncStore((s) => s.isOnline);
  const deviceId = useDeviceStore((s) => s.deviceId);

  const [photos, setPhotos] = useState<PhotoQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoQueueItem | null>(null);

  // Load photos from database
  const loadPhotos = useCallback(async () => {
    if (!isReady || !db) return;

    try {
      const pending = await db.getPendingPhotos(100);
      setPhotos(pending);
    } catch (error) {
      console.error('[PhotoQueue] Error loading photos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isReady, db]);

  // Check network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnlineStatus(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, [setOnlineStatus]);

  // Load photos on mount
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPhotos();
  }, [loadPhotos]);

  const handleDeletePhoto = useCallback(
    async (localId: string) => {
      if (!db) return;

      const photo = photos.find((p) => p.localId === localId);
      if (!photo) return;

      try {
        // Delete from file system
        await deletePhoto(photo.localPath);

        // Mark as uploaded (effectively removes from pending)
        await db.markPhotoUploaded(localId, 'deleted');

        // Update local state
        setPhotos((prev) => prev.filter((p) => p.localId !== localId));
      } catch (error) {
        console.error('[PhotoQueue] Error deleting photo:', error);
      }
    },
    [db, photos]
  );

  const handleUploadAll = useCallback(async () => {
    if (!db || !isOnline || uploading) return;

    setUploading(true);

    try {
      const baseUrl = BACKEND_URL;

      for (const photo of photos) {
        if (photo.uploadStatus === 'uploaded') continue;

        try {
          // Mark as uploading
          await db.markPhotoUploading(photo.localId);

          // Create form data for upload
          const formData = new FormData();
          formData.append('photo', {
            uri: photo.localPath,
            type: 'image/jpeg',
            name: `photo_${photo.localId}.jpg`,
          } as any);
          formData.append('localId', photo.localId);
          formData.append('teamId', photo.teamId);
          formData.append('eventId', photo.eventId);
          formData.append('overlayType', photo.overlayType);
          // Capturing phone id — gates phone-side original cleanup.
          if (deviceId) {
            formData.append('deviceId', deviceId);
          }

          // Upload to backend
          const response = await fetch(`${baseUrl}/api/photos/upload`, {
            method: 'POST',
            body: formData,
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          if (response.ok) {
            const result = await response.json();
            await db.markPhotoUploaded(photo.localId, result.data?.url ?? 'uploaded');
          } else {
            await db.markPhotoUploadFailed(photo.localId);
          }
        } catch (error) {
          console.error('[PhotoQueue] Error uploading photo:', error);
          await db.markPhotoUploadFailed(photo.localId);
        }
      }

      // Reload photos
      await loadPhotos();
    } finally {
      setUploading(false);
    }
  }, [db, isOnline, uploading, photos, loadPhotos, deviceId]);

  const handleClearQueue = useCallback(() => {
    Alert.alert(
      'Clear Queue',
      'Are you sure you want to delete all photos in the queue? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear from file system
              await clearStoredPhotos();

              // Clear from database (mark all as uploaded)
              if (db) {
                for (const photo of photos) {
                  await db.markPhotoUploaded(photo.localId, 'cleared');
                }
              }

              setPhotos([]);
            } catch (error) {
              console.error('[PhotoQueue] Error clearing queue:', error);
            }
          },
        },
      ]
    );
  }, [db, photos]);

  const handlePhotoPress = useCallback((photo: PhotoQueueItem) => {
    setSelectedPhoto(photo);
  }, []);

  const pendingCount = photos.filter(
    (p) => p.uploadStatus === 'pending' || p.uploadStatus === 'failed'
  ).length;

  if (loading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      {/* Status bar */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-zinc-800">
        <View className="flex-row items-center gap-2">
          {isOnline ? (
            <Wifi size={18} color="#22c55e" />
          ) : (
            <WifiOff size={18} color="#ef4444" />
          )}
          <Text className="text-zinc-400 text-sm">
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        <Text className="text-zinc-400 text-sm">
          {pendingCount} pending
        </Text>
      </View>

      {/* Photo list */}
      {photos.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <ImageIcon size={64} color="#3f3f46" />
          <Text className="text-white text-xl font-bold mt-6 text-center">
            No Photos in Queue
          </Text>
          <Text className="text-zinc-500 text-center mt-2">
            Photos you take will appear here for upload
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#fff"
            />
          }
        >
          {photos.map((photo) => (
            <PhotoQueueItemCard
              key={photo.localId}
              photo={photo}
              onDelete={handleDeletePhoto}
              onPress={handlePhotoPress}
            />
          ))}
        </ScrollView>
      )}

      {/* Action buttons */}
      {photos.length > 0 ? (
        <View className="px-4 py-4 border-t border-zinc-800 gap-3">
          <Pressable
            onPress={handleUploadAll}
            disabled={!isOnline || uploading || pendingCount === 0}
            className={`flex-row items-center justify-center h-14 rounded-xl ${
              isOnline && !uploading && pendingCount > 0
                ? 'bg-white'
                : 'bg-zinc-800'
            }`}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Upload
                size={22}
                color={isOnline && pendingCount > 0 ? '#000' : '#71717a'}
              />
            )}
            <Text
              className={`ml-2 font-bold text-lg ${
                isOnline && !uploading && pendingCount > 0
                  ? 'text-black'
                  : 'text-zinc-500'
              }`}
            >
              {uploading ? 'Uploading...' : 'Upload All'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleClearQueue}
            className="flex-row items-center justify-center h-12 rounded-xl border border-zinc-700"
          >
            <Trash2 size={20} color="#ef4444" />
            <Text className="ml-2 text-red-500 font-semibold">Clear Queue</Text>
          </Pressable>
        </View>
      ) : null}

      {/* QR Code modal for selected photo */}
      {selectedPhoto ? (
        <Pressable
          onPress={() => setSelectedPhoto(null)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Text className="text-white text-xl font-bold mb-6">
            Photo ID
          </Text>
          <QRCodeDisplay
            value={selectedPhoto.localId}
            size={220}
            label="Use this ID to find the photo on the tablet"
          />
          <Text className="text-zinc-500 text-sm mt-8">
            Tap anywhere to close
          </Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
