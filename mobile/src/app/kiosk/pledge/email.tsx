import { useState, useCallback, useMemo } from 'react';
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
import { usePhotoCacheStore } from '@/lib/state/photo-cache-store';
import { useSyncStore } from '@/lib/state/sync-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { api } from '@/lib/api/api';
import type { CompositePhotoResponse } from '@/lib/api/types';

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

  const setPledgeEmail = usePledgeStore((s) => s.setEmail);
  const completePledge = usePledgeStore((s) => s.completePledge);
  const resetPledge = usePledgeStore((s) => s.reset);
  const selectedPhotoLocalId = usePledgeStore((s) => s.selectedPhotoLocalId);
  const resetSurvey = useSurveyStore((s) => s.reset);

  const markPhotoUsed = usePhotoCacheStore((s) => s.markPhotoUsed);
  const cachedPhotos = usePhotoCacheStore((s) => s.cachedPhotos);
  const updateCounts = useSyncStore((s) => s.updateCounts);
  const pendingPledges = useSyncStore((s) => s.pendingPledges);
  const teamId = useDeviceStore((s) => s.teamId);
  const currentEventId = useDeviceStore((s) => s.currentEventId);
  const currentEventOverlayId = useDeviceStore((s) => s.currentEventOverlayId);
  const picturePledgeEnabled = useDeviceStore((s) => s.picturePledgeEnabled);

  // Get the selected photo's remote URL for compositing
  const selectedPhotoUrl = useMemo(() => {
    if (!selectedPhotoLocalId) return null;
    const photo = cachedPhotos.find((p) => p.localId === selectedPhotoLocalId);
    // The photo's localPath may be a local file or a remote URL
    // For compositing, we need the remote URL
    return photo?.localPath ?? null;
  }, [selectedPhotoLocalId, cachedPhotos]);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text.toLowerCase());
    setIsValid(isValidEmail(text));
  }, []);

  const handleSubmitEmail = useCallback(async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let compositedPhotoUrl: string | null = null;

      // If picture pledge is enabled and we have a photo selected, composite it
      if (picturePledgeEnabled && selectedPhotoUrl && currentEventOverlayId) {
        try {
          const compositeResult = await api.post<CompositePhotoResponse>(
            '/api/photos/composite',
            {
              photoUrl: selectedPhotoUrl,
              overlayId: currentEventOverlayId,
            }
          );
          compositedPhotoUrl = compositeResult?.url ?? null;
        } catch (compositeError) {
          console.error('[EmailScreen] Failed to composite photo:', compositeError);
          // Continue without composited photo - the pledge can still be saved
        }
      }

      setPledgeEmail(email);
      const pledgeData = completePledge();

      // Save to database
      if (db && teamId && currentEventId) {
        await db.queuePledge({
          localId: pledgeData.localId,
          surveyLocalId: pledgeData.surveyLocalId,
          teamId,
          eventId: currentEventId,
          email: pledgeData.email,
          photoLocalId: pledgeData.photoLocalId,
          compositedPhotoUrl, // Include the composited photo URL
          createdAt: pledgeData.createdAt,
        });

        // Mark photo as used if one was selected
        if (selectedPhotoLocalId) {
          await db.markPhotoUsed(selectedPhotoLocalId);
          markPhotoUsed(selectedPhotoLocalId);
        }

        // Update pending counts
        updateCounts({ pendingPledges: pendingPledges + 1 });
      }

      router.push('/kiosk/pledge/thank-you' as any);
    } catch (error) {
      console.error('[EmailScreen] Error submitting pledge:', error);
      setIsSubmitting(false);
    }
  }, [isValid, isSubmitting, email, setPledgeEmail, completePledge, db, teamId, currentEventId, selectedPhotoLocalId, selectedPhotoUrl, currentEventOverlayId, picturePledgeEnabled, markPhotoUsed, updateCounts, pendingPledges, router]);

  const handleSkipEmail = useCallback(async () => {
    setIsSubmitting(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      setPledgeEmail(null);
      const pledgeData = completePledge();

      // Save to database
      if (db && teamId && currentEventId) {
        await db.queuePledge({
          localId: pledgeData.localId,
          surveyLocalId: pledgeData.surveyLocalId,
          teamId,
          eventId: currentEventId,
          email: null,
          photoLocalId: pledgeData.photoLocalId,
          compositedPhotoUrl: null, // No compositing when skipping email
          createdAt: pledgeData.createdAt,
        });

        // Mark photo as used if one was selected
        if (selectedPhotoLocalId) {
          await db.markPhotoUsed(selectedPhotoLocalId);
          markPhotoUsed(selectedPhotoLocalId);
        }

        // Update pending counts
        updateCounts({ pendingPledges: pendingPledges + 1 });
      }

      router.push('/kiosk/pledge/thank-you' as any);
    } catch (error) {
      console.error('[EmailScreen] Error skipping pledge:', error);
      setIsSubmitting(false);
    }
  }, [setPledgeEmail, completePledge, db, teamId, currentEventId, selectedPhotoLocalId, markPhotoUsed, updateCounts, pendingPledges, router]);

  // Handle idle reset
  const handleIdleReset = useCallback(() => {
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
                We'll send your pledge photo to this email
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
                  style={{
                    color: '#ffffff',
                    fontSize: isTablet ? 20 : 18,
                    padding: 0,
                  }}
                />
              </View>
              {email && !isValid ? (
                <Text
                  style={{
                    color: '#ef4444',
                    fontSize: 14,
                    marginTop: 8,
                    marginLeft: 4,
                  }}
                >
                  Please enter a valid email address
                </Text>
              ) : null}
            </Animated.View>

            {/* Action Buttons */}
            <Animated.View
              entering={FadeIn.duration(400).delay(200)}
              style={{ gap: 12 }}
            >
              <ActionButton
                label="Send My Pledge"
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
