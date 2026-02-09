import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
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
import { ClipboardList, Camera, TrendingUp, Percent } from 'lucide-react-native';
import { SURVEY_TYPES } from '@/lib/api/types';

// Mock data generator
const generateMockData = (startDate: Date, endDate: Date, surveyType: string) => {
  const days: { label: string; value: number }[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    days.push({
      label: `${current.getMonth() + 1}/${current.getDate()}`,
      value: Math.floor(Math.random() * 30) + 5,
    });
    current.setDate(current.getDate() + 1);
  }

  return days.slice(-7); // Max 7 days for display
};

// Mock question response data
const MOCK_QUESTION_RESPONSES = [
  {
    question: 'Q1: Awareness',
    responses: [
      { label: 'Yes', value: 156, color: CHART_COLORS.green },
      { label: 'No', value: 44, color: CHART_COLORS.red },
    ],
  },
  {
    question: 'Q2: Prior Experience',
    responses: [
      { label: 'Never', value: 89, color: CHART_COLORS.blue },
      { label: 'Once', value: 67, color: CHART_COLORS.purple },
      { label: 'Multiple', value: 44, color: CHART_COLORS.amber },
    ],
  },
  {
    question: 'Q3: Impact Level',
    responses: [
      { label: 'Low', value: 45, color: CHART_COLORS.green },
      { label: 'Medium', value: 98, color: CHART_COLORS.amber },
      { label: 'High', value: 57, color: CHART_COLORS.red },
    ],
  },
];

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

  // Generate chart data based on filters
  const dailyData = useMemo(() => {
    return generateMockData(
      dateRange.startDate,
      dateRange.endDate,
      filters.surveyType as string
    );
  }, [dateRange, filters.surveyType]);

  const surveyTypeData = useMemo(() => {
    return SURVEY_TYPES.map((type) => ({
      label: type.label,
      value: Math.floor(Math.random() * 50) + 10,
      color: SURVEY_TYPE_COLORS[type.slug],
    }));
  }, [dateRange]);

  const totalSurveys = surveyTypeData.reduce((sum, d) => sum + d.value, 0);
  const totalPledges = Math.floor(totalSurveys * 0.68);
  const conversionRate = Math.round((totalPledges / totalSurveys) * 100);
  const avgPerDay = Math.round(totalSurveys / 7);

  const handleExport = async (): Promise<string> => {
    // Generate CSV content
    const headers = ['Date', 'Survey Type', 'Count', 'Pledges'];
    const rows = dailyData.map((d) => [d.label, 'All', d.value, Math.floor(d.value * 0.68)]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return csv;
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

        {/* Key Metrics */}
        <View className="flex-row mb-4 gap-3">
          <SummaryCard
            icon={ClipboardList}
            label="Total Surveys"
            value={totalSurveys}
            accentColor={CHART_COLORS.blue}
            className="flex-1"
          />
          <SummaryCard
            icon={Camera}
            label="Total Pledges"
            value={totalPledges}
            accentColor={CHART_COLORS.purple}
            className="flex-1"
          />
        </View>

        <View className="flex-row mb-6 gap-3">
          <SummaryCard
            icon={Percent}
            label="Conversion"
            value={`${conversionRate}%`}
            accentColor={CHART_COLORS.green}
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
          {MOCK_QUESTION_RESPONSES.map((q, index) => (
            <View key={index} className="mb-6 last:mb-0">
              <Text className="text-zinc-400 text-sm mb-3">{q.question}</Text>
              <BarChart data={q.responses} />
            </View>
          ))}
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
            responses and pledge information.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
