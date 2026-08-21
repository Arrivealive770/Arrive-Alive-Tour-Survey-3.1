import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Cannabis,
  Wine,
  Smartphone,
  AlertTriangle,
  Layers,
  ClipboardList,
} from 'lucide-react-native';
import { SurveyTypeCard } from '@/components/kiosk';
import { useSurveyStore } from '@/lib/state/survey-store';
import { useDeviceStore } from '@/lib/state/device-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { api } from '@/lib/api/api';
import { useSurveyTypes } from '@/lib/survey-questions';
import type { LucideIcon } from 'lucide-react-native';
import type { SurveyTypeSlug, Event } from '@/lib/api/types';

const AATLogo = require('@/assets/aat-logo.png');

// Icons for the surveys that ship with the app. Admin-built surveys aren't in
// here, so they fall back to a generic icon and the name from the server.
const SURVEY_TYPE_INFO: Record<string, { name: string; Icon: LucideIcon }> = {
  marijuana: { name: 'Marijuana', Icon: Cannabis },
  alcohol: { name: 'Alcohol', Icon: Wine },
  distracted: { name: 'Distracted Driving', Icon: Smartphone },
  impaired: { name: 'Impaired Driving', Icon: AlertTriangle },
  combo: { name: 'Combo Survey', Icon: Layers },
};

export default function KioskHome() {
  const router = useRouter();
  const { db, isReady } = useDatabase();
  const startSurvey = useSurveyStore((s) => s.startSurvey);
  const currentEventId = useDeviceStore((s) => s.currentEventId);
  const setDeviceConfig = useDeviceStore((s) => s.setDeviceConfig);

  // Downloads and caches the questions while the kiosk is idle, so the survey
  // itself still works if the venue's connection drops later. Also gives us the
  // display name for surveys the admin built themselves.
  const { data: builtSurveys } = useSurveyTypes();

  const [surveyTypes, setSurveyTypes] = useState<SurveyTypeSlug[]>([]);
  const [venueName, setVenueName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [autoStarted, setAutoStarted] = useState(false);

  // Load survey types from the current event AND refresh picture pledge settings from server
  useEffect(() => {
    async function loadEventData() {
      if (!isReady || !db) return;

      try {
        const currentEvent = await db.getCurrentEvent();

        if (currentEvent) {
          setVenueName(currentEvent.venueName || '');

          if (currentEvent.surveyTypes) {
            try {
              const types = JSON.parse(currentEvent.surveyTypes) as SurveyTypeSlug[];
              setSurveyTypes(types);
            } catch {
              console.error('[KioskHome] Failed to parse survey types');
              setSurveyTypes([]);
            }
          }
        }

        // Refresh event settings from server to get latest picturePledgeEnabled
        if (currentEventId) {
          try {
            const event = await api.get<Event>(`/api/events/${currentEventId}`);
            console.log('[KioskHome] Refreshed event from server:', {
              picturePledgeEnabled: event.picturePledgeEnabled,
              overlayType: event.overlayType,
            });
            setDeviceConfig({
              picturePledgeEnabled: event.picturePledgeEnabled ?? false,
              currentEventOverlayId: event.overlayType || null,
            });
          } catch (err) {
            console.error('[KioskHome] Failed to refresh event from server:', err);
          }
        }
      } catch (error) {
        console.error('[KioskHome] Error loading event data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadEventData();
  }, [isReady, db, currentEventId, setDeviceConfig]);

  // Auto-start if only one survey type
  useEffect(() => {
    if (!loading && surveyTypes.length === 1 && !autoStarted) {
      setAutoStarted(true);
      startSurvey(surveyTypes[0]);
      if (db) {
        db.updateActiveSurveyType(surveyTypes[0]).catch(console.error);
      }
      router.push('/kiosk/survey/1' as any);
    }
  }, [loading, surveyTypes, autoStarted, startSurvey, db, router]);

  const handleSelectSurveyType = useCallback(
    (slug: string) => {
      startSurvey(slug);
      if (db) {
        db.updateActiveSurveyType(slug).catch(console.error);
      }
      router.push('/kiosk/survey/1' as any);
    },
    [startSurvey, db, router]
  );

  if (loading || (surveyTypes.length === 1 && !autoStarted)) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22c55e" />
          <Text className="text-zinc-400 mt-4 text-lg">
            {surveyTypes.length === 1 ? 'Starting survey...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // If no survey types configured, show error
  if (surveyTypes.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <AlertTriangle size={64} color="#ef4444" />
          <Text className="text-white text-2xl font-bold mt-6 text-center">
            No Surveys Configured
          </Text>
          <Text className="text-zinc-400 text-lg mt-2 text-center">
            This event has no survey types set up. Contact your administrator.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Multiple survey types - show selection screen
  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      <View className="flex-1 px-6">
        {/* Logo and Header */}
        <View className="py-6">
          <View className="items-center mb-4">
            <Image
              source={AATLogo}
              style={{ width: 160, height: 80 }}
              resizeMode="contain"
            />
          </View>
          <Text className="text-4xl font-bold text-white text-center mb-2">
            Select Survey
          </Text>
          {venueName ? (
            <Text className="text-lg text-zinc-400 text-center">
              {venueName}
            </Text>
          ) : null}
        </View>

        {/* Survey Type Grid */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 16,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {surveyTypes.map((slug) => {
            // An admin-built survey has no built-in icon — show it anyway using
            // its name from the server, otherwise it silently disappears here.
            const info = SURVEY_TYPE_INFO[slug] ?? {
              name: builtSurveys?.find((survey) => survey.slug === slug)?.name ?? slug,
              Icon: ClipboardList,
            };

            return (
              <SurveyTypeCard
                key={slug}
                name={info.name}
                slug={slug}
                Icon={info.Icon}
                onPress={handleSelectSurveyType}
              />
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
