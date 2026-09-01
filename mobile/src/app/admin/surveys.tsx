import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  BarChart3,
  ExternalLink,
  Monitor,
} from 'lucide-react-native';
import { useSurveyTypes, type SurveyTypeDefinition } from '@/lib/survey-questions';
import { cn } from '@/lib/cn';
import { useRouter } from 'expo-router';
import { BACKEND_URL } from '@/lib/api/backend-url';

export default function SurveysScreen() {
  const router = useRouter();
  const [expandedSurvey, setExpandedSurvey] = useState<string | null>(null);

  // Fetch survey types (shared cache with the kiosk)
  const { data: surveyTypes, isLoading, refetch, isRefetching } = useSurveyTypes();

  const activeSurveys = surveyTypes?.filter((s) => s.isActive) || [];
  const inactiveSurveys = surveyTypes?.filter((s) => !s.isActive) || [];

  const openWebAdmin = () => {
    const backendUrl = BACKEND_URL;
    if (backendUrl) {
      Linking.openURL(`${backendUrl}/admin`);
    }
  };

  const renderSurveyCard = (survey: SurveyTypeDefinition) => {
    const isExpanded = expandedSurvey === survey.id;

    return (
      <View key={survey.id} className="bg-zinc-900 rounded-xl mb-3 overflow-hidden">
        <Pressable
          onPress={() => setExpandedSurvey(isExpanded ? null : survey.id)}
          className="flex-row items-center p-4"
        >
          <View className={cn(
            'w-10 h-10 rounded-xl items-center justify-center mr-3',
            survey.isActive ? 'bg-blue-500/20' : 'bg-zinc-800'
          )}>
            <ClipboardList size={20} color={survey.isActive ? '#3b82f6' : '#71717a'} />
          </View>
          <View className="flex-1">
            <Text className="text-white font-medium">{survey.name}</Text>
            <Text className="text-zinc-500 text-sm">{survey.slug}</Text>
          </View>
          <View className="flex-row items-center">
            <View className={cn(
              'px-2 py-1 rounded-full mr-3',
              survey.isActive ? 'bg-green-500/20' : 'bg-zinc-800'
            )}>
              <Text className={cn(
                'text-xs',
                survey.isActive ? 'text-green-500' : 'text-zinc-500'
              )}>
                {survey.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
            {isExpanded ? (
              <ChevronUp size={20} color="#71717a" />
            ) : (
              <ChevronDown size={20} color="#71717a" />
            )}
          </View>
        </Pressable>

        {isExpanded ? (
          <View className="px-4 pb-4 border-t border-zinc-800">
            {survey.description ? (
              <Text className="text-zinc-400 text-sm mt-3 mb-3">{survey.description}</Text>
            ) : null}

            <Text className="text-zinc-500 text-xs uppercase tracking-wider mb-2 mt-2">
              {survey.questions.length} Question{survey.questions.length !== 1 ? 's' : ''}
            </Text>

            {survey.questions.map((q, i) => (
              <View key={q.id || i} className="bg-zinc-800 rounded-lg p-3 mb-2">
                <Text className="text-white text-sm mb-1">
                  {i + 1}. {q.questionText}
                </Text>
                <Text className="text-zinc-500 text-xs">
                  {q.options.length} options | {q.isRequired ? 'Required' : 'Optional'}
                </Text>
              </View>
            ))}

            {/* View Results Button */}
            <Pressable
              onPress={() => router.push(`/admin/survey-results?slug=${survey.slug}`)}
              className="flex-row items-center justify-center bg-purple-500/20 py-3 rounded-xl mt-4"
            >
              <BarChart3 size={16} color="#a855f7" />
              <Text className="text-purple-500 font-medium ml-2">View Results (Pie Charts)</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor="#3b82f6"
          />
        }
      >
        {/* Web Admin Notice */}
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-2">
            <Monitor size={18} color="#3b82f6" />
            <Text className="text-blue-500 font-medium ml-2">Manage Surveys on Web</Text>
          </View>
          <Text className="text-zinc-400 text-sm mb-3">
            To add, edit, or delete surveys, use the web admin portal on a computer.
          </Text>
          <Pressable
            onPress={openWebAdmin}
            className="flex-row items-center justify-center bg-blue-600 py-2 px-4 rounded-lg"
          >
            <ExternalLink size={16} color="#fff" />
            <Text className="text-white font-medium ml-2">Open Web Admin</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#fff" />
            <Text className="text-zinc-400 mt-4">Loading surveys...</Text>
          </View>
        ) : (
          <>
            {/* Active Surveys */}
            <View className="mb-6">
              <Text className="text-white text-lg font-semibold mb-3">Active Surveys</Text>
              {activeSurveys.length > 0 ? (
                activeSurveys.map(renderSurveyCard)
              ) : (
                <View className="bg-zinc-900 rounded-2xl p-6 items-center">
                  <Text className="text-zinc-500">No active survey types</Text>
                  <Text className="text-zinc-600 text-sm mt-1">
                    Add surveys using the web admin portal
                  </Text>
                </View>
              )}
            </View>

            {/* Inactive Surveys */}
            {inactiveSurveys.length > 0 ? (
              <View className="mb-6">
                <Text className="text-zinc-400 text-lg font-semibold mb-3">Inactive Surveys</Text>
                {inactiveSurveys.map(renderSurveyCard)}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
