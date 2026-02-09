import { View, Text } from 'react-native';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { cn } from '@/lib/cn';

interface SummaryCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  accentColor?: string;
  className?: string;
}

export function SummaryCard({
  icon: Icon,
  label,
  value,
  trend,
  accentColor = '#3b82f6', // blue-500 default
  className,
}: SummaryCardProps) {
  const TrendIcon = trend?.direction === 'up'
    ? TrendingUp
    : trend?.direction === 'down'
    ? TrendingDown
    : Minus;

  const trendColor = trend?.direction === 'up'
    ? '#10b981' // green-500
    : trend?.direction === 'down'
    ? '#ef4444' // red-500
    : '#71717a'; // zinc-500

  return (
    <View
      className={cn(
        'bg-zinc-800 rounded-2xl p-4 border-l-4',
        className
      )}
      style={{ borderLeftColor: accentColor }}
    >
      <View className="flex-row items-center mb-2">
        <View
          className="w-8 h-8 rounded-lg items-center justify-center mr-2"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <Icon size={18} color={accentColor} />
        </View>
        <Text className="text-zinc-400 text-sm flex-1" numberOfLines={1}>
          {label}
        </Text>
      </View>

      <View className="flex-row items-end justify-between">
        <Text className="text-white text-3xl font-bold">
          {value}
        </Text>

        {trend ? (
          <View className="flex-row items-center">
            <TrendIcon size={14} color={trendColor} />
            <Text
              className="text-xs ml-1"
              style={{ color: trendColor }}
            >
              {trend.value}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
