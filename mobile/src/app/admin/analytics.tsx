import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  DateRangePicker,
  getPresetDateRange,
  type DateRange,
} from '@/components/admin/DateRangePicker';
import { FilterBar, type FilterConfig } from '@/components/admin/FilterBar';
import { SummaryCard } from '@/components/admin/SummaryCard';
import { BarChart, PieChart, LineChart, SURVEY_TYPE_COLORS, CHART_COLORS } from '@/components/admin/AnalyticsChart';
import { ExportButton } from '@/components/admin/ExportButton';
import { ClipboardList, TrendingUp } from 'lucide-react-native';
import { SURVEY_TYPES } from '@/lib/api/types';
import { api } from '@/lib/api/api';
import { useDeviceStore } from '@/lib/state/device-store';

interface AnalyticsData {
  totalSurveys: number;
  surveysByType: { surveyTypeSlug: string; count: number }[];
  surveysByDay: { date: string; count: number }[];
}

interface SurveyResultsData {
  totalResponses: number;
  questionResults: {
    questionId: string;
    orderIndex: number;
    questionText: string;
    totalResponses: number;
    options: { label: string; count: number; percentage: number }[];
  }[];
}

const QUESTION_COLORS = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.amber,
  CHART_COLORS.purple,
  CHART_COLORS.red,
];

const toDateParam = (date: Date) => date.toISOString();

export default function AnalyticsScreen() {
  const router = useRouter();

  const [dateRange, setDateRange] = useState<DateRange>(getPresetDateRange('7days'));
  const [filters, setFilters] = useState<Record<string, string | string[]>>({
    surveyType: '',
  });

  const filterConfigs: FilterConfig[] = [
    {
      key: 'surveyType',
      label: 'Survey Type',
      options: [
        { key: 'all', label: 'All', value: '' },
        ...SURVEY_TYPES.map((t) => ({
          key: t.slug,
          label: t.label,
          value: t.slug,
        })),
      ],
    },
  ];

  const handleFilterChange = (key: string, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const teamId = useDeviceStore((state) => state.teamId);
  const selectedType = (filters.surveyType as string) || '';
  const startParam = toDateParam(dateRange.startDate);
  const endParam = toDateParam(dateRange.endDate);

  const analyticsQuery = useQuery({
    queryKey: ['admin', 'analytics', teamId, startParam, endParam],
    enabled: !!teamId,
    queryFn: () =>
      api.get<AnalyticsData>(
        `/api/admin/analytics?teamId=${teamId}&startDate=${startParam}&endDate=${endParam}`
      ),
  });

  // Per-question breakdown is only meaningful for one survey type at a time.
  const resultsQuery = useQuery({
    queryKey: ['admin', 'survey-results', selectedType, teamId, startParam, endParam],
    enabled: !!selectedType && !!teamId,
    queryFn: () =>
      api.get<SurveyResultsData>(
        `/api/surveys/results/${selectedType}?teamId=${teamId}&startDate=${startParam}&endDate=${endParam}`
      ),
  });

  const analytics = analyticsQuery.data;
  const isLoading = analyticsQuery.isLoading;
  const isError = analyticsQuery.isError;

  const dailyData = useMemo(() => {
    const byDay = analytics?.surveysByDay ?? [];
    return byDay.slice(-7).map((day) => {
      const [, month, dayOfMonth] = day.date.split('-');
      return { label: `${Number(month)}/${Number(dayOfMonth)}`, value: day.count };
    });
  }, [analytics]);

  const surveyTypeData = useMemo(() => {
    const counts = new Map(
      (analytics?.surveysByType ?? []).map((row) => [row.surveyTypeSlug, row.count])
    );
    return SURVEY_TYPES.map((type) => ({
      label: type.label,
      value: counts.get(type.slug) ?? 0,
      color: SURVEY_TYPE_COLORS[type.slug],
    })).filter((row) => row.value > 0);
  }, [analytics]);

  const questionBreakdown = useMemo(() => {
    const results = selectedType ? resultsQuery.data?.questionResults ?? [] : [];
    return results.map((question) => ({
      question: `Q${question.orderIndex}: ${question.questionText}`,
      responses: question.options.map((option, index) => ({
        label: option.label,
        value: option.count,
        color: QUESTION_COLORS[index % QUESTION_COLORS.length],
      })),
    }));
  }, [selectedType, resultsQuery.data]);

  const filteredTypeTotal = selectedType
    ? surveyTypeData.find((row) => row.label === SURVEY_TYPES.find((t) => t.slug === selectedType)?.label)?.value ?? 0
    : 0;

  const totalSurveys = selectedType ? filteredTypeTotal : analytics?.totalSurveys ?? 0;
  const dayCount = Math.max(
    1,
    Math.round(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (24 * 60 * 60 * 1000)
    )
  );
  const avgPerDay = Math.round(totalSurveys / dayCount);

  // Pull the real CSV the server generates rather than re-deriving it here.
  const handleExport = async (): Promise<string> => {
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
    const response = await fetch(
      `${baseUrl}/api/admin/export/csv?teamId=${teamId}&startDate=${startParam}&endDate=${endParam}`
    );
    if (!response.ok) {
      throw new Error('Export failed');
    }
    return response.text();
  };

  return (
    <View className="flex-1 bg-black">
      {/* Header with back button */}
      <View className="flex-row items-center px-4 py-3 border-b border-zinc-800">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center mr-4"
        >
          <ChevronLeft size={24} color="#3b82f6" />
          <Text className="text-blue-500 font-medium">Dashboard</Text>
        </Pressable>
        <Text className="text-white text-lg font-semibold flex-1">Analytics</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
      >
        {/* Date Range Picker */}
        <View className="mb-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </View>

        {/* Filters */}
        <View className="mb-6">
          <FilterBar
            filters={filterConfigs}
            values={filters}
            onChange={handleFilterChange}
          />
        </View>

        {/* Key Metrics. Pledge totals and conversion are deliberately not shown:
            the admin views report on surveys, not on who pledged. */}
        <View className="flex-row mb-6 gap-3">
          <SummaryCard
            icon={ClipboardList}
            label="Total Surveys"
            value={totalSurveys}
            accentColor={CHART_COLORS.blue}
            className="flex-1"
          />
          <SummaryCard
            icon={TrendingUp}
            label="Avg/Day"
            value={avgPerDay}
            accentColor={CHART_COLORS.amber}
            className="flex-1"
          />
        </View>

        {/* Loading / error state for the synced numbers */}
        {isLoading ? (
          <View className="items-center py-4">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : null}
        {isError ? (
          <View className="bg-red-500/10 rounded-xl p-4 mb-4">
            <Text className="text-red-400 text-sm text-center">
              Could not load analytics. These numbers come from the server, so this
              device needs an internet connection.
            </Text>
          </View>
        ) : null}

        {/* Daily Surveys Chart */}
        <View className="bg-zinc-900 rounded-2xl p-4 mb-4">
          <Text className="text-white font-semibold mb-4">Surveys by Day</Text>
          <LineChart data={dailyData} color={CHART_COLORS.blue} />
        </View>

        {/* Survey Type Breakdown */}
        <View className="bg-zinc-900 rounded-2xl p-4 mb-4">
          <Text className="text-white font-semibold mb-4">Surveys by Type</Text>
          <PieChart data={surveyTypeData} />
        </View>

        {/* Question Response Breakdown */}
        <View className="bg-zinc-900 rounded-2xl p-4 mb-4">
          <Text className="text-white font-semibold mb-4">
            Question Response Breakdown
          </Text>
          {!selectedType ? (
            <Text className="text-zinc-500 text-sm">
              Pick a survey type above to see how each question was answered.
            </Text>
          ) : resultsQuery.isLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : questionBreakdown.length === 0 ? (
            <Text className="text-zinc-500 text-sm">No responses yet for this survey.</Text>
          ) : (
            questionBreakdown.map((q, index) => (
              <View key={index} className="mb-6 last:mb-0">
                <Text className="text-zinc-400 text-sm mb-3">{q.question}</Text>
                <BarChart data={q.responses} />
              </View>
            ))
          )}
        </View>

        {/* Export Button */}
        <ExportButton
          onExport={handleExport}
          fileName={`analytics-${dateRange.startDate.toISOString().split('T')[0]}.csv`}
          className="mb-6"
        />

        {/* Info */}
        <View className="bg-zinc-900/50 rounded-xl p-4 mb-6">
          <Text className="text-zinc-500 text-sm text-center">
            Data shown is for the selected date range. Export includes all survey
            responses.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
