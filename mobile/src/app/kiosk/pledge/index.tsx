import { useCallback, useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, useWindowDimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImageIcon, ArrowRight, SkipForward } from 'lucide-react-native';
import { PhotoGrid, OverlayPreview } from '@/components/pledge';
import { IdleResetTimer } from '@/components/kiosk';
import { usePledgeStore } from '@/lib/state/pledge-store';
import { usePhotoCacheStore } from '@/lib/state/photo-cache-store';
import { useSurveyStore } from '@/lib/state/survey-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { api } from '@/lib/api/api';
import type { Overlay } from '@/lib/api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IDLE_TIMEOUT = 60000; // 60 seconds

export default function PhotoSelectionScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width > 600;

  const setPhoto = usePledgeStore((s) => s.setPhoto);
  const selectedPhotoLocalId = usePledgeStore((s) => s.selectedPhotoLocalId);
  const resetPledge = usePledgeStore((s) => s.reset);
  const resetSurvey = useSurveyStore((s) => s.reset);

  const cachedPhotos = usePhotoCacheStore((s) => s.cachedPhotos);
  const availablePhotos = cachedPhotos.filter((p) => p.status === 'available');
  const hasAvailablePhotos = availablePhotos.length > 0;

  // Get current event's overlay ID from device store
  const currentEventOverlayId = useDeviceStore((s) => s.currentEventOverlayId);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);

  // Fetch overlay data when component mounts
  useEffect(() => {
    async function fetchOverlay() {
      if (!currentEventOverlayId) return;

      try {
        const overlay = await api.get<Overlay>(`/api/overlays/${currentEventOverlayId}`);
        if (overlay?.imageUrl) {
          setOverlayUrl(overlay.imageUrl);
        }
      } catch (error) {
        console.error('[PhotoSelectionScreen] Failed to fetch overlay:', error);
      }
    }

    fetchOverlay();
  }, [currentEventOverlayId]);

  // Get the selected photo's local path for preview
  const selectedPhoto = useMemo(() => {
    if (!selectedPhotoLocalId) return null;
    return cachedPhotos.find((p) => p.localId === selectedPhotoLocalId) ?? null;
  }, [selectedPhotoLocalId, cachedPhotos]);

  const handleSelectPhoto = useCallback(
    (localId: string) => {
      // Toggle selection
      if (selectedPhotoLocalId === localId) {
        setPhoto(null);
      } else {
        setPhoto(localId);
      }
    },
    [selectedPhotoLocalId, setPhoto]
  );

  const handleUsePhoto = useCallback(() => {
    if (selectedPhotoLocalId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push('/kiosk/pledge/email' as any);
    }
  }, [selectedPhotoLocalId, router]);

  const handleSkipPhoto = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhoto(null);
    router.push('/kiosk/pledge/email' as any);
  }, [setPhoto, router]);

  // Handle idle reset
  const handleIdleReset = useCallback(() => {
    resetPledge();
    resetSurvey();
    router.replace('/kiosk');
  }, [resetPledge, resetSurvey, router]);

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
              {hasAvailablePhotos
                ? 'Tap a photo to select it for your pledge'
                : 'No photos available at the moment'}
            </Text>
          </Animated.View>

          {/* Photo Grid or Preview with Overlay */}
          <View style={{ flex: 1 }}>
            {selectedPhoto ? (
              // Show preview with overlay when a photo is selected
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
                  Preview with Overlay
                </Text>
                <View style={{ width: isTablet ? 400 : 280 }}>
                  <OverlayPreview
                    photoUri={selectedPhoto.localPath}
                    overlayUrl={overlayUrl}
                  />
                </View>
                <Pressable
                  onPress={() => setPhoto(null)}
                  style={{
                    marginTop: 16,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                  }}
                >
                  <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
                    Tap to choose a different photo
                  </Text>
                </Pressable>
              </ScrollView>
            ) : (
              // Show photo grid when no photo is selected
              <PhotoGrid
                selectedPhotoId={selectedPhotoLocalId}
                onSelectPhoto={handleSelectPhoto}
              />
            )}
          </View>

          {/* Footer Buttons */}
          <Animated.View
            entering={FadeIn.duration(400).delay(200)}
            style={{
              paddingHorizontal: 24,
              paddingBottom: isTablet ? 32 : 24,
              paddingTop: 16,
              gap: 12,
            }}
          >
            {hasAvailablePhotos && selectedPhotoLocalId ? (
              <ActionButton
                label="Use This Photo"
                icon={<ArrowRight size={24} color="#000000" />}
                variant="primary"
                onPress={handleUsePhoto}
                disabled={false}
              />
            ) : null}

            <ActionButton
              label={hasAvailablePhotos ? 'Skip Photo' : 'Continue Without Photo'}
              icon={<SkipForward size={20} color="#a1a1aa" />}
              variant="secondary"
              onPress={handleSkipPhoto}
              disabled={false}
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    </IdleResetTimer>
  );
}

interface ActionButtonProps {
  label: string;
  icon?: React.ReactNode;
  variant: 'primary' | 'secondary';
  onPress: () => void;
  disabled?: boolean;
}

function ActionButton({ label, icon, variant, onPress, disabled }: ActionButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    if (!disabled) {
      scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
    }
  }, [scale, disabled]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (!disabled) {
      onPress();
    }
  }, [disabled, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isPrimary = variant === 'primary';

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
          backgroundColor: disabled
            ? '#1a1a1a'
            : isPrimary
            ? '#22c55e'
            : '#27272a',
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
          color: disabled ? '#52525b' : isPrimary ? '#000000' : '#a1a1aa',
        }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
