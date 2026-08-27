import { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Keyboard, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Mail, Send, SkipForward } from 'lucide-react-native';
import { IdleResetTimer } from '@/components/kiosk';
import { usePledgeStore } from '@/lib/state/pledge-store';
import { useSurveyStore } from '@/lib/state/survey-store';
import { useSyncStore } from '@/lib/state/sync-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { api } from '@/lib/api/api';
import type { CompositePhotoResponse, Photo } from '@/lib/api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IDLE_TIMEOUT = 120000; // 2 minutes for email entry

// Simple email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default function EmailScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width > 600;
  const { db } = useDatabase();

  const [email, setEmail] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setPledgeEmail = usePledgeStore((s) => s.setEmail);
  const completePledge = usePledgeStore((s) => s.completePledge);
  const resetPledge = usePledgeStore((s) => s.reset);
  const selectedPhotoId = usePledgeStore((s) => s.selectedPhotoId);
  const selectedPhotoLocalId = usePledgeStore((s) => s.selectedPhotoLocalId);
  const selectedPhotoOriginalUrl = usePledgeStore((s) => s.selectedPhotoOriginalUrl);
  const finishedPhotoUrl = usePledgeStore((s) => s.finishedPhotoUrl);
  const resetSurvey = useSurveyStore((s) => s.reset);

  const updateCounts = useSyncStore((s) => s.updateCounts);
  const pendingPledges = useSyncStore((s) => s.pendingPledges);
  const teamId = useDeviceStore((s) => s.teamId);
  const currentEventId = useDeviceStore((s) => s.currentEventId);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text.toLowerCase());
    setIsValid(isValidEmail(text));
  }, []);

  /**
   * Persist the pledge locally (queued for sync) and update counts.
   * Throws if the pledge cannot be stored — callers surface that to the user
   * rather than showing a thank-you screen for a pledge that was never saved.
   */
  const queuePledgeLocally = useCallback(
    async (pledgeEmail: string | null, finishedUrl: string | null): Promise<void> => {
      if (!db || !teamId || !currentEventId) {
        throw new Error(
          `Cannot queue pledge - missing ${!db ? 'database' : !teamId ? 'team' : 'event'}`
        );
      }

      if (pledgeEmail) {
        setPledgeEmail(pledgeEmail);
      } else {
        setPledgeEmail(null);
      }
      const pledgeData = completePledge();

      await db.queuePledge({
        localId: pledgeData.localId,
        surveyLocalId: pledgeData.surveyLocalId,
        teamId,
        eventId: currentEventId,
        email: pledgeEmail,
        photoLocalId: selectedPhotoLocalId,
        photoId: selectedPhotoId,
        compositedPhotoUrl: finishedUrl,
        createdAt: pledgeData.createdAt,
      });
      updateCounts({ pendingPledges: pendingPledges + 1 });
    },
    [
      setPledgeEmail,
      completePledge,
      db,
      teamId,
      currentEventId,
      selectedPhotoLocalId,
      selectedPhotoId,
      updateCounts,
      pendingPledges,
    ]
  );

  const handleSubmitEmail = useCallback(async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // No photo selected (skipped or no photos): just queue the email pledge.
    if (!selectedPhotoId) {
      try {
        await queuePledgeLocally(email, null);
        router.push('/kiosk/pledge/thank-you' as any);
      } catch (e) {
        console.error('[EmailScreen] Failed to save pledge:', e);
        setError('Something went wrong. Please try again.');
        setIsSubmitting(false);
      }
      return;
    }

    // Photo pledge send flow: process -> ensure finished url -> queue pledge -> sent -> delete.
    try {
      // 1. Move photo to processing.
      await api.put<Photo>(`/api/photos/${selectedPhotoId}/process`, {
        finishedPhotoUrl: finishedPhotoUrl ?? undefined,
      });

      // 2. Ensure we have a finished (composited) url. Retry composite if missing.
      let finishedUrl = finishedPhotoUrl;
      if (!finishedUrl && selectedPhotoOriginalUrl) {
        const composite = await api.post<CompositePhotoResponse>(
          '/api/photos/composite',
          { photoUrl: selectedPhotoOriginalUrl, eventId: currentEventId }
        );
        finishedUrl = composite?.compositedUrl ?? null;
      }
      if (!finishedUrl) {
        throw new Error('Finished photo unavailable');
      }

      // 3. Create the pledge (queued -> sync sends the email with the finished photo).
      await queuePledgeLocally(email, finishedUrl);

      // 4. Mark the photo sent, then deleted (propagates cleanup to phone + tablets).
      await api.put<Photo>(`/api/photos/${selectedPhotoId}/sent`, {
        finishedPhotoUrl: finishedUrl,
      });
      await api.put<Photo>(`/api/photos/${selectedPhotoId}/delete`, {});

      router.push('/kiosk/pledge/thank-you' as any);
    } catch (e) {
      console.error('[EmailScreen] Pledge send failed:', e);
      // Release the photo back to available so it can be retried by someone.
      try {
        await api.put<Photo>(`/api/photos/${selectedPhotoId}/release`, {});
      } catch (releaseError) {
        console.error('[EmailScreen] Release failed:', releaseError);
      }
      setError('Could not send your pledge photo. Please try again.');
      setIsSubmitting(false);
    }
  }, [
    isValid,
    isSubmitting,
    email,
    selectedPhotoId,
    selectedPhotoOriginalUrl,
    finishedPhotoUrl,
    currentEventId,
    queuePledgeLocally,
    router,
  ]);

  const handleSkipEmail = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      // Skipping email: no photo is delivered. Release any selected photo.
      if (selectedPhotoId) {
        try {
          await api.put<Photo>(`/api/photos/${selectedPhotoId}/release`, {});
        } catch (releaseError) {
          console.error('[EmailScreen] Release failed:', releaseError);
        }
      }
      await queuePledgeLocally(null, null);
      usePledgeStore.getState().clearBackendPhoto();
      router.push('/kiosk/pledge/thank-you' as any);
    } catch (e) {
      console.error('[EmailScreen] Skip pledge failed:', e);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }, [isSubmitting, selectedPhotoId, queuePledgeLocally, router]);

  const handleIdleReset = useCallback(() => {
    const currentPhotoId = usePledgeStore.getState().selectedPhotoId;
    if (currentPhotoId) {
      api.put<Photo>(`/api/photos/${currentPhotoId}/release`, {}).catch(() => {});
    }
    resetPledge();
    resetSurvey();
    router.replace('/kiosk');
  }, [resetPledge, resetSurvey, router]);

  return (
    <IdleResetTimer timeoutMs={IDLE_TIMEOUT} onReset={handleIdleReset} enabled={true}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'bottom']}>
        <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
            {/* Header */}
            <Animated.View
              entering={FadeIn.duration(400)}
              style={{ alignItems: 'center', marginBottom: 32 }}
            >
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#22c55e20',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 24,
                }}
              >
                <Mail size={40} color="#22c55e" />
              </View>
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: isTablet ? 36 : 28,
                  fontWeight: '700',
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                Enter Your Email
              </Text>
              <Text
                style={{
                  color: '#a1a1aa',
                  fontSize: isTablet ? 18 : 16,
                  textAlign: 'center',
                  maxWidth: 400,
                }}
              >
                {selectedPhotoId
                  ? "We'll send your pledge photo to this email"
                  : "We'll send your pledge confirmation to this email"}
              </Text>
            </Animated.View>

            {/* Email Input */}
            <Animated.View
              entering={FadeIn.duration(400).delay(100)}
              style={{ marginBottom: 24 }}
            >
              <View
                style={{
                  backgroundColor: '#18181b',
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: email ? (isValid ? '#22c55e' : '#ef4444') : '#27272a',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                }}
              >
                <TextInput
                  value={email}
                  onChangeText={handleEmailChange}
                  placeholder="Enter your email address"
                  placeholderTextColor="#52525b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!isSubmitting}
                  style={{
                    color: '#ffffff',
                    fontSize: isTablet ? 20 : 18,
                    padding: 0,
                  }}
                />
              </View>
              {email && !isValid ? (
                <Text
                  style={{ color: '#ef4444', fontSize: 14, marginTop: 8, marginLeft: 4 }}
                >
                  Please enter a valid email address
                </Text>
              ) : null}
              {error ? (
                <Text
                  style={{ color: '#ef4444', fontSize: 14, marginTop: 8, marginLeft: 4 }}
                >
                  {error}
                </Text>
              ) : null}
            </Animated.View>

            {/* Action Buttons */}
            <Animated.View
              entering={FadeIn.duration(400).delay(200)}
              style={{ gap: 12 }}
            >
              <ActionButton
                label={isSubmitting ? 'Sending...' : 'Send My Pledge'}
                icon={<Send size={24} color={isValid && !isSubmitting ? '#000000' : '#52525b'} />}
                variant="primary"
                onPress={handleSubmitEmail}
                disabled={!isValid || isSubmitting}
              />

              <ActionButton
                label="Skip"
                icon={<SkipForward size={20} color="#a1a1aa" />}
                variant="secondary"
                onPress={handleSkipEmail}
                disabled={isSubmitting}
              />
            </Animated.View>
          </View>
        </Pressable>
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
