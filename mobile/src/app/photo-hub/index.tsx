import { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, Modal, Image, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Images, Layers, Check, X, AlertCircle, Wifi } from 'lucide-react-native';
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
import { getLocalPhotoSenderService } from '@/lib/services/local-photo-sender';

export default function PhotoHubCamera() {
  const { db, isReady } = useDatabase();
  const teamId = useDeviceStore((s) => s.teamId);
  const eventId = useDeviceStore((s) => s.currentEventId);
  const localPhotoTransferEnabled = useDeviceStore((s) => s.localPhotoTransferEnabled);
  const selectedOverlay = useSelectedOverlay();
  const addPhoto = usePhotoStore((s) => s.addPhoto);
  const queueCount = usePhotoQueueCount();

  const cameraRef = useRef<CameraCaptureRef>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const currentOverlay: OverlayType = (selectedOverlay as OverlayType) ?? 'default';
  const overlayConfig = getOverlayConfig(currentOverlay);

  // Check if we have a valid event
  const hasValidEvent = !!eventId && eventId !== 'no-event';

  const handleCapture = useCallback(
    async (uri: string) => {
      if (!isReady || !db) return;

      // Don't allow capture without a valid event
      if (!hasValidEvent) {
        Alert.alert(
          'No Event Selected',
          'Please select an event before taking photos. Go to Admin Settings to select an event.',
          [{ text: 'OK' }]
        );
        return;
      }

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
    [isReady, db, currentOverlay, hasValidEvent]
  );

  const handleConfirmPhoto = useCallback(async () => {
    if (!previewUri || !db || !teamId || !eventId) return;

    try {
      // Generate unique ID
      const localId = uuidv4();

      // Add to SQLite queue
      await db.queuePhoto({
        localId,
        teamId,
        eventId,
        localPath: previewUri,
        overlayType: currentOverlay,
      });

      // Add to in-memory store
      addPhoto(previewUri, currentOverlay);

      // If local transfer is enabled, also send directly to tablet
      if (localPhotoTransferEnabled) {
        try {
          const sender = getLocalPhotoSenderService();
          await sender.sendPhotoFromPath(previewUri, {
            localId,
            teamId,
            eventId,
            overlayType: currentOverlay,
          });
          console.log('[PhotoHubCamera] Photo sent to tablet locally');
        } catch (localError) {
          console.log('[PhotoHubCamera] Local transfer failed, photo queued for later:', localError);
          // Don't show error to user - photo is still queued locally
        }
      }

      // Close preview and return to camera
      setShowPreview(false);
      setPreviewUri(null);
    } catch (error) {
      console.error('[PhotoHubCamera] Error saving photo:', error);
    }
  }, [previewUri, db, teamId, eventId, currentOverlay, addPhoto, localPhotoTransferEnabled]);

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

        {/* No event warning banner */}
        {!hasValidEvent ? (
          <View
            style={{
              position: 'absolute',
              top: 120,
              left: 16,
              right: 16,
              backgroundColor: 'rgba(239, 68, 68, 0.9)',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <AlertCircle size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 }}>
              No event selected. Go to Admin Settings to select an event.
            </Text>
          </View>
        ) : null}

        {/* Local Mode indicator - shows when local transfer is enabled */}
        {localPhotoTransferEnabled ? (
          <View
            style={{
              position: 'absolute',
              top: 70,
              left: '50%',
              transform: [{ translateX: -50 }],
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(34, 197, 94, 0.85)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              gap: 6,
            }}
          >
            <Wifi size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
              Local Mode
            </Text>
          </View>
        ) : null}

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
