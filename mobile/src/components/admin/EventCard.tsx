import { View, Text, Pressable } from 'react-native';
import { MapPin, Calendar, Users, CheckCircle2, Clock } from 'lucide-react-native';
import { cn } from '@/lib/cn';

export interface EventCardProps {
  id: string;
  venueName: string;
  city: string;
  state: string;
  date: string;
  surveyCount: number;
  status: 'active' | 'completed';
  onPress?: () => void;
}

export function EventCard({
  venueName,
  city,
  state,
  date,
  surveyCount,
  status,
  onPress,
}: EventCardProps) {
  const isActive = status === 'active';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'bg-zinc-900 rounded-2xl p-4 mb-3 border',
        isActive ? 'border-green-500/30' : 'border-zinc-800'
      )}
    >
      {/* Header Row */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-white text-lg font-bold" numberOfLines={1}>
            {venueName}
          </Text>
          <View className="flex-row items-center mt-1">
            <MapPin size={14} color="#71717a" />
            <Text className="text-zinc-400 text-sm ml-1">
              {city}, {state}
            </Text>
          </View>
        </View>

        {/* Status Badge */}
        <View
          className={cn(
            'px-3 py-1 rounded-full flex-row items-center',
            isActive ? 'bg-green-500/20' : 'bg-zinc-800'
          )}
        >
          {isActive ? (
            <Clock size={12} color="#22c55e" />
          ) : (
            <CheckCircle2 size={12} color="#71717a" />
          )}
          <Text
            className={cn(
              'text-xs font-medium ml-1',
              isActive ? 'text-green-500' : 'text-zinc-500'
            )}
          >
            {isActive ? 'Active' : 'Completed'}
          </Text>
        </View>
      </View>

      {/* Date Row */}
      <View className="flex-row items-center mb-3">
        <Calendar size={14} color="#71717a" />
        <Text className="text-zinc-400 text-sm ml-1">{formatDate(date)}</Text>
      </View>

      {/* Stats Row */}
      <View className="flex-row items-center border-t border-zinc-800 pt-3">
        <View className="flex-row items-center flex-1">
          <View className="w-8 h-8 rounded-lg bg-blue-500/20 items-center justify-center">
            <Users size={16} color="#3b82f6" />
          </View>
          <View className="ml-2">
            <Text className="text-white text-lg font-bold">{surveyCount}</Text>
            <Text className="text-zinc-500 text-xs">Surveys</Text>
          </View>
        </View>

        {isActive ? (
          <View className="w-3 h-3 rounded-full bg-green-500" />
        ) : null}
      </View>
    </Pressable>
  );
}
