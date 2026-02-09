import { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, Modal, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Images, Layers, Check, X } from 'lucide-react-native';
import { CameraCapture, OverlayPreview, type CameraCaptureRef } from '@/components/photo-hub';
import { usePhotoStore, useSelectedOverlay, usePhotoQueueCount } from '@/lib/state/photo-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import {
  applyOverlay,
  type OverlayType,
  getOverlayConfig,
} from '@/lib/overlays/overlay-service';
import { v4 as uuidv4 } from 'uuid';

export default function PhotoHubCamera() {
  const { db, isReady } = useDatabase();
  const teamId = useDeviceStore((s) => s.teamId);
  const eventId = useDeviceStore((s) => s.currentEventId);
  const selectedOverlay = useSelectedOverlay();
  const addPhoto = usePhotoStore((s) => s.addPhoto);
  const queueCount = usePhotoQueueCount();

  const cameraRef = useRef<CameraCaptureRef>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const currentOverlay: OverlayType = (selectedOverlay as OverlayType) ?? 'default';
  const overlayConfig = getOverlayConfig(currentOverlay);

  const handleCapture = useCallback(
    async (uri: string) => {
      if (!isReady || !db) return;

      try {
        setIsProcessing(true);

        // Apply overlay and save to file system
        const savedPath = await applyOverlay(uri, currentOverlay);

        // Show preview
        setPreviewUri(savedPath);
        setShowPreview(true);
      } catch (error) {
        console.error('[PhotoHubCamera] Error processing photo:', error);
      } finally {
        setIsProcessing(false);
      }
    },
    [isReady, db, currentOverlay]
  );

  const handleConfirmPhoto = useCallback(async () => {
    if (!previewUri || !db || !teamId) return;

    try {
      // Generate unique ID
      const localId = uuidv4();

      // Add to SQLite queue
      await db.queuePhoto({
        localId,
        teamId,
        eventId: eventId ?? 'no-event',
        localPath: previewUri,
        overlayType: currentOverlay,
      });

      // Add to in-memory store
      addPhoto(previewUri, currentOverlay);

      // Close preview and return to camera
      setShowPreview(false);
      setPreviewUri(null);
    } catch (error) {
      console.error('[PhotoHubCamera] Error saving photo:', error);
    }
  }, [previewUri, db, teamId, eventId, currentOverlay, addPhoto]);

  const handleDiscardPhoto = useCallback(() => {
    setShowPreview(false);
    setPreviewUri(null);
  }, []);

  const handleOpenQueue = useCallback(() => {
    router.push('/photo-hub/queue' as any);
  }, []);

  const handleSelectOverlay = useCallback(() => {
    router.push('/photo-hub/overlay-select' as any);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraCapture ref={cameraRef} onCapture={handleCapture}>
        {/* Overlay preview on camera */}
        <OverlayPreview overlayType={currentOverlay} />

        {/* Queue badge button - top right */}
        <Pressable
          onPress={handleOpenQueue}
          style={{
            position: 'absolute',
            top: 70,
            right: 16,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 20,
            gap: 8,
          }}
        >
          <Images size={20} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
            {queueCount}
          </Text>
        </Pressable>

        {/* Overlay selector button - top left */}
        <Pressable
          onPress={handleSelectOverlay}
          style={{
            position: 'absolute',
            top: 70,
            left: 16,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 20,
            gap: 8,
            borderWidth: 2,
            borderColor: overlayConfig.color,
          }}
        >
          <Layers size={20} color={overlayConfig.color} />
          <Text style={{ color: overlayConfig.color, fontSize: 14, fontWeight: '700' }}>
            {overlayConfig.label}
          </Text>
        </Pressable>
      </CameraCapture>

      {/* Processing overlay */}
      {isProcessing ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: 16, fontSize: 16 }}>
            Processing photo...
          </Text>
        </View>
      ) : null}

      {/* Photo Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="fade"
        transparent
        onRequestClose={handleDiscardPhoto}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.95)',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          {/* Preview Image with overlay */}
          <View
            style={{
              flex: 1,
              maxHeight: '70%',
              borderRadius: 16,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            ) : null}

            {/* Overlay frame on preview */}
            <OverlayPreview overlayType={currentOverlay} showBadge={false} />
          </View>

          {/* Action buttons */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 24,
              marginTop: 32,
              paddingBottom: 32,
            }}
          >
            {/* Discard */}
            <Pressable
              onPress={handleDiscardPhoto}
              style={({ pressed }) => ({
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: pressed ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.5)',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <X size={36} color="#fff" />
            </Pressable>

            {/* Confirm */}
            <Pressable
              onPress={handleConfirmPhoto}
              style={({ pressed }) => ({
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: pressed ? 'rgba(34, 197, 94, 0.8)' : '#22c55e',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Check size={36} color="#fff" />
            </Pressable>
          </View>

          <Text style={{ color: '#71717a', textAlign: 'center', fontSize: 14 }}>
            Tap the check to save, X to retake
          </Text>
        </View>
      </Modal>
    </View>
  );
}
