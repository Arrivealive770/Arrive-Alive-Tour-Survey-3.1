import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ClipboardList, Users, Car, Shield, GraduationCap, Heart } from 'lucide-react-native';
import { SurveyTypeCard, IdleResetTimer } from '@/components/kiosk';
import { useSurveyStore } from '@/lib/state/survey-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import type { LucideIcon } from 'lucide-react-native';

// Mock survey types - in production, these come from current_event.surveyTypes
const MOCK_SURVEY_TYPES = [
  { slug: 'high-school', name: 'High School', icon: 'graduation' },
  { slug: 'college', name: 'College', icon: 'users' },
  { slug: 'general', name: 'General Public', icon: 'clipboard' },
  { slug: 'military', name: 'Military', icon: 'shield' },
];

// Map icon names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  graduation: GraduationCap,
  users: Users,
  clipboard: ClipboardList,
  car: Car,
  shield: Shield,
  heart: Heart,
};

interface SurveyType {
  slug: string;
  name: string;
  icon?: string;
}

export default function SurveyTypeSelection() {
  const router = useRouter();
  const { db, isReady } = useDatabase();
  const startSurvey = useSurveyStore((s) => s.startSurvey);

  const [surveyTypes, setSurveyTypes] = useState<SurveyType[]>([]);
  const [loading, setLoading] = useState(true);

  // Load survey types from database
  useEffect(() => {
    async function loadSurveyTypes() {
      if (!isReady || !db) return;

      try {
        const currentEvent = await db.getCurrentEvent();

        if (currentEvent?.surveyTypes) {
          try {
            const types = JSON.parse(currentEvent.surveyTypes) as SurveyType[];
            if (types.length > 0) {
              setSurveyTypes(types);
            } else {
              setSurveyTypes(MOCK_SURVEY_TYPES);
            }
          } catch {
            setSurveyTypes(MOCK_SURVEY_TYPES);
          }
        } else {
          // Use mock data if no event configured
          setSurveyTypes(MOCK_SURVEY_TYPES);
        }
      } catch (error) {
        console.error('[SurveyTypeSelection] Error loading survey types:', error);
        setSurveyTypes(MOCK_SURVEY_TYPES);
      } finally {
        setLoading(false);
      }
    }

    loadSurveyTypes();
  }, [isReady, db]);

  const handleSelectSurveyType = useCallback(
    (slug: string) => {
      // Start the survey with the selected type
      startSurvey(slug);

      // Update active survey type in database
      if (db) {
        db.updateActiveSurveyType(slug).catch(console.error);
      }

      // Navigate to first question
      router.push('/kiosk/survey/1' as any);
    },
    [startSurvey, db, router]
  );

  // This is the staff selection screen - no idle reset here
  // Idle reset only happens on survey screens

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22c55e" />
          <Text className="text-zinc-400 mt-4 text-lg">Loading survey types...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      <View className="flex-1 px-6">
        {/* Header */}
        <View className="py-8">
          <Text className="text-4xl font-bold text-white text-center mb-2">
            Select Survey Type
          </Text>
          <Text className="text-lg text-zinc-400 text-center">
            Choose the appropriate survey for this participant
          </Text>
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
          {surveyTypes.map((type) => (
            <SurveyTypeCard
              key={type.slug}
              name={type.name}
              slug={type.slug}
              Icon={type.icon ? ICON_MAP[type.icon] : ClipboardList}
              onPress={handleSelectSurveyType}
            />
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
