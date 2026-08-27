import { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImageIcon, ArrowRight, RefreshCw, Camera } from 'lucide-react-native';
import { IdleResetTimer } from '@/components/kiosk';
import { usePledgeStore } from '@/lib/state/pledge-store';
import { useSurveyStore } from '@/lib/state/survey-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { api, ApiError } from '@/lib/api/api';
import type {
  AvailablePhoto,
  Photo,
  CompositePhotoResponse,
} from '@/lib/api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IDLE_TIMEOUT = 60000; // 60 seconds
// How often the grid re-checks for photos just taken on the phone.
const PHOTO_POLL_INTERVAL_MS = 5000;

export default function PhotoSelectionScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width > 600;

  const resetPledge = usePledgeStore((s) => s.reset);
  const resetSurvey = useSurveyStore((s) => s.reset);
  const setBackendPhoto = usePledgeStore((s) => s.setBackendPhoto);
  const setFinishedPhotoUrl = usePledgeStore((s) => s.setFinishedPhotoUrl);
  const selectedPhotoId = usePledgeStore((s) => s.selectedPhotoId);
  const finishedPhotoUrl = usePledgeStore((s) => s.finishedPhotoUrl);
  const selectedPhotoOriginalUrl = usePledgeStore((s) => s.selectedPhotoOriginalUrl);

  const teamId = useDeviceStore((s) => s.teamId);
  const eventId = useDeviceStore((s) => s.currentEventId);
  const deviceId = useDeviceStore((s) => s.deviceId);

  const [photos, setPhotos] = useState<AvailablePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Fetch ONLY available photos for this team + event (shared across both tablets).
  const loadPhotos = useCallback(async () => {
    if (!teamId || !eventId) {
      setPhotos([]);
      setIsLoading(false);
      return;
    }
    try {
      const result = await api.get<AvailablePhoto[]>(
        `/api/sync/photos/${teamId}/${eventId}`
      );
      setPhotos(result ?? []);
    } catch (error) {
      console.error('[PhotoSelection] Failed to load photos:', error);
      setPhotos([]);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, eventId]);

  // Keep the grid live. Photos arrive from the roaming phone at any moment, and
  // the other tablet can take one at any moment too, so re-check on a short
  // timer instead of making guests hunt for the Refresh button. Polling pauses
  // once a photo is picked (the preview shouldn't flicker underneath them).
  useEffect(() => {
    loadPhotos();

    if (selectedPhotoId) return;

    const interval = setInterval(loadPhotos, PHOTO_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadPhotos, selectedPhotoId]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleSelectPhoto = useCallback(
    async (photo: AvailablePhoto) => {
      if (isSelecting || !deviceId) return;

      setIsSelecting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      try {
        // 1. Atomically lock the photo (available -> selected).
        await api.put<Photo>(`/api/photos/${photo.id}/select`, { deviceId });

        setBackendPhoto({
          photoId: photo.id,
          photoLocalId: photo.localId,
          originalUrl: photo.storageUrl,
        });

        // 2. Composite the event overlay onto the original (portrait/landscape safe).
        try {
          const composite = await api.post<CompositePhotoResponse>(
            '/api/photos/composite',
            { photoUrl: photo.storageUrl, eventId }
          );
          setFinishedPhotoUrl(composite?.compositedUrl ?? null);
        } catch (compositeError) {
          console.error('[PhotoSelection] Composite failed:', compositeError);
          // Preview the original if compositing fails; send flow will retry.
          setFinishedPhotoUrl(null);
        }
      } catch (error) {
        if (error instanceof ApiError && error.code === 'PHOTO_NOT_AVAILABLE') {
          showToast('That photo was just taken — pick another');
        } else {
          console.error('[PhotoSelection] Select failed:', error);
          showToast('Could not select that photo — try again');
        }
        // Refresh the grid so taken photos disappear.
        await loadPhotos();
      } finally {
        setIsSelecting(false);
      }
    },
    [
      isSelecting,
      deviceId,
      eventId,
      setBackendPhoto,
      setFinishedPhotoUrl,
      loadPhotos,
      showToast,
    ]
  );

  const handleUsePhoto = useCallback(() => {
    if (selectedPhotoId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      router.push('/kiosk/pledge/email' as any);
    }
  }, [selectedPhotoId, router]);

  // Choosing a different photo releases the currently-selected one back to available.
  const handleChooseDifferent = useCallback(async () => {
    const currentId = selectedPhotoId;
    usePledgeStore.getState().clearBackendPhoto();
    if (currentId) {
      try {
        await api.put<Photo>(`/api/photos/${currentId}/release`, {});
      } catch (error) {
        console.error('[PhotoSelection] Release failed:', error);
      }
    }
    await loadPhotos();
  }, [selectedPhotoId, loadPhotos]);

  const handleIdleReset = useCallback(() => {
    // Release any selected photo on idle so it isn't stranded.
    const currentId = usePledgeStore.getState().selectedPhotoId;
    if (currentId) {
      api.put<Photo>(`/api/photos/${currentId}/release`, {}).catch(() => {});
    }
    resetPledge();
    resetSurvey();
    router.replace('/kiosk');
  }, [resetPledge, resetSurvey, router]);

  const hasSelection = !!selectedPhotoId;
  const previewUri = finishedPhotoUrl ?? selectedPhotoOriginalUrl;

  return (
    <IdleResetTimer timeoutMs={IDLE_TIMEOUT} onReset={handleIdleReset} enabled={true}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'bottom']}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <Animated.View
            entering={FadeIn.duration(400)}
            style={{
              paddingHorizontal: 24,
              paddingTop: isTablet ? 32 : 24,
              paddingBottom: 16,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <ImageIcon size={isTablet ? 32 : 28} color="#22c55e" style={{ marginRight: 12 }} />
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: isTablet ? 36 : 28,
                  fontWeight: '700',
                }}
              >
                Select Your Pledge Photo
              </Text>
            </View>
            <Text
              style={{
                color: '#a1a1aa',
                fontSize: isTablet ? 18 : 16,
                textAlign: 'center',
              }}
            >
              {hasSelection
                ? 'Here is your pledge photo with the event overlay'
                : photos.length > 0
                ? 'Tap a photo to select it for your pledge'
                : 'No photos available at the moment'}
            </Text>
          </Animated.View>

          {/* Toast */}
          {toast ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{
                marginHorizontal: 24,
                marginBottom: 8,
                backgroundColor: '#7f1d1d',
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ color: '#fecaca', fontSize: 15, textAlign: 'center' }}>
                {toast}
              </Text>
            </Animated.View>
          ) : null}

          {/* Content: preview when selected, grid otherwise */}
          <View style={{ flex: 1 }}>
            {isLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#22c55e" />
                <Text style={{ color: '#a1a1aa', marginTop: 16, fontSize: 16 }}>
                  Loading photos...
                </Text>
              </View>
            ) : hasSelection ? (
              <ScrollView
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 24,
                }}
              >
                <Text
                  style={{
                    color: '#22c55e',
                    fontSize: isTablet ? 20 : 16,
                    fontWeight: '600',
                    marginBottom: 16,
                  }}
                >
                  Preview
                </Text>
                <View
                  style={{
                    width: isTablet ? 420 : 300,
                    aspectRatio: 3 / 4,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: '#1a1a1a',
                  }}
                >
                  {previewUri ? (
                    <Image
                      source={{ uri: previewUri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                    >
                      <ActivityIndicator color="#22c55e" />
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={handleChooseDifferent}
                  style={{ marginTop: 16, paddingVertical: 8, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
                    Tap to choose a different photo
                  </Text>
                </Pressable>
              </ScrollView>
            ) : photos.length > 0 ? (
              <ScrollView
                contentContainerStyle={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: 24,
                  gap: 12,
                }}
                showsVerticalScrollIndicator={false}
              >
                {photos.map((photo) => (
                  <BackendPhotoCard
                    key={photo.id}
                    photo={photo}
                    disabled={isSelecting}
                    onSelect={handleSelectPhoto}
                  />
                ))}
              </ScrollView>
            ) : (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 32,
                }}
              >
                <View
                  style={{
                    backgroundColor: '#27272a',
                    padding: 24,
                    borderRadius: 999,
                    marginBottom: 20,
                  }}
                >
                  <Camera size={48} color="#71717a" />
                </View>
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 22,
                    fontWeight: '600',
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  No Photos Available
                </Text>
                <Text
                  style={{
                    color: '#a1a1aa',
                    fontSize: 16,
                    textAlign: 'center',
                    lineHeight: 24,
                    marginBottom: 20,
                  }}
                >
                  Please see a team member to have your photo taken.
                </Text>
                <Pressable
                  onPress={loadPhotos}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#27272a',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 12,
                  }}
                >
                  <RefreshCw size={18} color="#a1a1aa" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#a1a1aa', fontSize: 15, fontWeight: '600' }}>
                    Refresh
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Footer */}
          {hasSelection ? (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={{
                paddingHorizontal: 24,
                paddingBottom: isTablet ? 32 : 24,
                paddingTop: 16,
              }}
            >
              <ActionButton
                label="Use This Photo"
                icon={<ArrowRight size={24} color="#000000" />}
                onPress={handleUsePhoto}
                disabled={false}
              />
            </Animated.View>
          ) : null}
        </View>
      </SafeAreaView>
    </IdleResetTimer>
  );
}

interface BackendPhotoCardProps {
  photo: AvailablePhoto;
  disabled: boolean;
  onSelect: (photo: AvailablePhoto) => void;
}

function BackendPhotoCard({ photo, disabled, onSelect }: BackendPhotoCardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    if (!disabled) scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, [scale, disabled]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (!disabled) onSelect(photo);
  }, [disabled, onSelect, photo]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      style={[
        animatedStyle,
        {
          width: '47%',
          aspectRatio: 3 / 4,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: '#27272a',
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <Image
        source={{ uri: photo.storageUrl ?? undefined }}
        style={{ width: '100%', height: '100%', backgroundColor: '#1a1a1a' }}
        resizeMode="cover"
      />
    </AnimatedPressable>
  );
}

interface ActionButtonProps {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}

function ActionButton({ label, icon, onPress, disabled }: ActionButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    if (!disabled) scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  }, [scale, disabled]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (!disabled) onPress();
  }, [disabled, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      style={[
        animatedStyle,
        {
          width: '100%',
          minHeight: 60,
          backgroundColor: disabled ? '#1a1a1a' : '#22c55e',
          borderRadius: 16,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 16,
          paddingHorizontal: 24,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
      <Text
        style={{
          fontSize: 18,
          fontWeight: '600',
          color: disabled ? '#52525b' : '#000000',
        }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
