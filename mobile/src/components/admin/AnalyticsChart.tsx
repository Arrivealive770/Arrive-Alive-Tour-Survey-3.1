import { View, Text } from 'react-native';
import { cn } from '@/lib/cn';

// Simple chart components that don't require victory-native
// Using custom implementation to avoid heavy dependencies

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  className?: string;
}

export function BarChart({ data, maxValue, className }: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <View className={cn('gap-3', className)}>
      {data.map((item, index) => (
        <View key={index} className="flex-row items-center">
          <View className="w-20">
            <Text className="text-zinc-400 text-xs" numberOfLines={1}>
              {item.label}
            </Text>
          </View>
          <View className="flex-1 h-6 bg-zinc-800 rounded-md overflow-hidden">
            <View
              className="h-full rounded-md"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color || '#3b82f6',
              }}
            />
          </View>
          <View className="w-12 items-end">
            <Text className="text-white font-medium text-sm">{item.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  className?: string;
}

export function PieChart({ data, size = 120, className }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  // Calculate segments
  let currentAngle = -90; // Start from top
  const segments: { startAngle: number; endAngle: number; color: string; label: string; percentage: number }[] = [];

  data.forEach((item) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    segments.push({
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
      color: item.color,
      label: item.label,
      percentage,
    });
    currentAngle += angle;
  });

  return (
    <View className={cn('items-center', className)}>
      {/* Simple legend instead of actual pie chart (SVG not easily supported) */}
      <View className="flex-row flex-wrap justify-center gap-3 mb-4">
        {data.map((item, index) => (
          <View key={index} className="flex-row items-center">
            <View
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: item.color }}
            />
            <Text className="text-zinc-400 text-sm">
              {item.label} ({Math.round((item.value / total) * 100)}%)
            </Text>
          </View>
        ))}
      </View>

      {/* Horizontal bar representation */}
      <View className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden flex-row">
        {data.map((item, index) => (
          <View
            key={index}
            className="h-full"
            style={{
              width: `${(item.value / total) * 100}%`,
              backgroundColor: item.color,
            }}
          />
        ))}
      </View>
    </View>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  color?: string;
  className?: string;
}

export function LineChart({ data, color = '#3b82f6', className }: LineChartProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;

  return (
    <View className={cn('', className)}>
      {/* Simplified line chart as bar chart */}
      <View className="h-32 flex-row items-end justify-between gap-1">
        {data.map((item, index) => (
          <View key={index} className="flex-1 items-center">
            <View
              className="w-full rounded-t-sm"
              style={{
                height: `${((item.value - min) / range) * 100}%`,
                minHeight: 4,
                backgroundColor: color,
              }}
            />
          </View>
        ))}
      </View>

      {/* Labels */}
      <View className="flex-row justify-between mt-2">
        {data.map((item, index) => (
          <View key={index} className="flex-1 items-center">
            <Text
              className="text-zinc-500"
              numberOfLines={1}
              style={{ fontSize: 10 }}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Chart color palette
export const CHART_COLORS = {
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#06b6d4',
  pink: '#ec4899',
  indigo: '#6366f1',
};

export const SURVEY_TYPE_COLORS: Record<string, string> = {
  marijuana: CHART_COLORS.green,
  alcohol: CHART_COLORS.amber,
  distracted: CHART_COLORS.blue,
  impaired: CHART_COLORS.red,
  combo: CHART_COLORS.purple,
};
