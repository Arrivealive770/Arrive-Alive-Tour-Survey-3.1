import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Cannabis, Wine, Smartphone, AlertTriangle, Layers } from 'lucide-react-native';
import { SurveyTypeCard } from '@/components/kiosk';
import { useSurveyStore } from '@/lib/state/survey-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import type { LucideIcon } from 'lucide-react-native';
import type { SurveyTypeSlug } from '@/lib/api/types';

const AATLogo = require('@/assets/aat-logo.png');

// Map survey type slugs to display info
const SURVEY_TYPE_INFO: Record<SurveyTypeSlug, { name: string; Icon: LucideIcon }> = {
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

  const [surveyTypes, setSurveyTypes] = useState<SurveyTypeSlug[]>([]);
  const [venueName, setVenueName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [autoStarted, setAutoStarted] = useState(false);

  // Load survey types from the current event
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
      } catch (error) {
        console.error('[KioskHome] Error loading event data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadEventData();
  }, [isReady, db]);

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
            const info = SURVEY_TYPE_INFO[slug];
            if (!info) return null;

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
