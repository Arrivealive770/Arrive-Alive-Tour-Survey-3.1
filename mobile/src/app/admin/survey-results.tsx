import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, ChevronDown, ChevronUp, PieChart as PieChartIcon } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/api';
import { PieChart, CHART_COLORS } from '@/components/admin/AnalyticsChart';

// Types for survey results
interface QuestionOption {
  label: string;
  count: number;
  percentage: number;
}

interface QuestionResult {
  questionId: string;
  orderIndex: number;
  questionText: string;
  totalResponses: number;
  options: QuestionOption[];
}

interface SurveyResults {
  surveyType: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
  };
  totalResponses: number;
  questionResults: QuestionResult[];
}

// Color palette for pie chart segments
const PIE_COLORS = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.purple,
  CHART_COLORS.amber,
  CHART_COLORS.red,
  CHART_COLORS.cyan,
  CHART_COLORS.pink,
  CHART_COLORS.indigo,
];

export default function SurveyResultsScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const {
    data: results,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['survey-results', slug],
    queryFn: () => api.get<SurveyResults>(`/api/surveys/results/${slug}`),
    enabled: !!slug,
  });

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    if (results?.questionResults) {
      setExpandedQuestions(new Set(results.questionResults.map((q) => q.questionId)));
    }
  };

  const collapseAll = () => {
    setExpandedQuestions(new Set());
  };

  if (!slug) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white">No survey selected</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-zinc-800">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center mr-4"
        >
          <ChevronLeft size={24} color="#3b82f6" />
          <Text className="text-blue-500 font-medium">Back</Text>
        </Pressable>
        <Text className="text-white text-lg font-semibold flex-1" numberOfLines={1}>
          {results?.surveyType?.name || 'Survey Results'}
        </Text>
      </View>

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
        {isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#fff" />
            <Text className="text-zinc-400 mt-4">Loading results...</Text>
          </View>
        ) : results != null ? (
          <>
            {/* Summary Card */}
            <View className="bg-zinc-900 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <PieChartIcon size={20} color="#3b82f6" />
                <Text className="text-white font-semibold ml-2">Survey Summary</Text>
              </View>
              <Text className="text-zinc-400 mb-3">{results.surveyType.description}</Text>
              <View className="flex-row justify-between">
                <View>
                  <Text className="text-zinc-500 text-xs uppercase">Total Responses</Text>
                  <Text className="text-white text-2xl font-bold">{results.totalResponses}</Text>
                </View>
                <View>
                  <Text className="text-zinc-500 text-xs uppercase">Questions</Text>
                  <Text className="text-white text-2xl font-bold">{results.questionResults.length}</Text>
                </View>
              </View>
            </View>

            {/* Expand/Collapse All */}
            <View className="flex-row gap-3 mb-4">
              <Pressable
                onPress={expandAll}
                className="flex-1 bg-zinc-800 py-2 rounded-lg items-center"
              >
                <Text className="text-blue-500 font-medium">Expand All</Text>
              </Pressable>
              <Pressable
                onPress={collapseAll}
                className="flex-1 bg-zinc-800 py-2 rounded-lg items-center"
              >
                <Text className="text-zinc-400 font-medium">Collapse All</Text>
              </Pressable>
            </View>

            {/* No responses message */}
            {results.totalResponses === 0 && (
              <View className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                <Text className="text-amber-500 text-center">
                  No responses collected yet. Results will appear here once surveys are completed.
                </Text>
              </View>
            )}

            {/* Question Results */}
            {results.questionResults.map((question) => {
              const isExpanded = expandedQuestions.has(question.questionId);
              const pieData = question.options.map((opt, i) => ({
                label: opt.label,
                value: opt.count,
                color: PIE_COLORS[i % PIE_COLORS.length],
              }));

              return (
                <View key={question.questionId} className="bg-zinc-900 rounded-2xl mb-3 overflow-hidden">
                  <Pressable
                    onPress={() => toggleQuestion(question.questionId)}
                    className="p-4 flex-row items-start"
                  >
                    <View className="w-8 h-8 rounded-full bg-blue-500/20 items-center justify-center mr-3">
                      <Text className="text-blue-500 font-bold">{question.orderIndex}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium">{question.questionText}</Text>
                      <Text className="text-zinc-500 text-sm mt-1">
                        {question.totalResponses} response{question.totalResponses !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={20} color="#71717a" />
                    ) : (
                      <ChevronDown size={20} color="#71717a" />
                    )}
                  </Pressable>

                  {isExpanded ? (
                    <View className="px-4 pb-4 border-t border-zinc-800 pt-4">
                      {question.totalResponses > 0 ? (
                        <>
                          {/* Pie Chart */}
                          <PieChart data={pieData} className="mb-4" />

                          {/* Detailed breakdown */}
                          <View className="gap-2">
                            {question.options.map((option, index) => (
                              <View
                                key={index}
                                className="flex-row items-center bg-zinc-800 rounded-lg p-3"
                              >
                                <View
                                  className="w-3 h-3 rounded-full mr-3"
                                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                />
                                <Text className="text-white flex-1">{option.label}</Text>
                                <Text className="text-zinc-400 mr-2">{option.count}</Text>
                                <View className="bg-zinc-700 px-2 py-1 rounded">
                                  <Text className="text-white font-medium text-sm">
                                    {option.percentage}%
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        </>
                      ) : (
                        <View className="items-center py-4">
                          <Text className="text-zinc-500">No responses yet</Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : (
          <View className="items-center py-12">
            <Text className="text-zinc-400">Failed to load results</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
