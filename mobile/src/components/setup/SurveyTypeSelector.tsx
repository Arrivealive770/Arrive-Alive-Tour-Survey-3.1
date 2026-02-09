import { Pressable, View, Text } from 'react-native';
import { cn } from '@/lib/cn';
import { Check, Square } from 'lucide-react-native';
import { SurveyTypeSlug, SURVEY_TYPES } from '@/lib/api/types';

interface SurveyTypeSelectorProps {
  selectedTypes: SurveyTypeSlug[];
  onToggle: (type: SurveyTypeSlug) => void;
  multiple?: boolean;
  className?: string;
}

export function SurveyTypeSelector({
  selectedTypes,
  onToggle,
  multiple = true,
  className,
}: SurveyTypeSelectorProps) {
  return (
    <View className={cn('w-full', className)}>
      {SURVEY_TYPES.map((surveyType) => {
        const isSelected = selectedTypes.includes(surveyType.slug);
        return (
          <Pressable
            key={surveyType.slug}
            onPress={() => onToggle(surveyType.slug)}
            className={cn(
              'flex-row items-center px-5 py-4 mb-3 rounded-xl border-2',
              isSelected
                ? 'bg-white border-white'
                : 'bg-zinc-900 border-zinc-700 active:bg-zinc-800'
            )}
          >
            <View
              className={cn(
                'w-7 h-7 rounded-md items-center justify-center mr-4',
                isSelected ? 'bg-black' : 'bg-zinc-800 border border-zinc-600'
              )}
            >
              {isSelected ? (
                <Check size={18} color="#fff" strokeWidth={3} />
              ) : null}
            </View>
            <Text
              className={cn(
                'text-lg font-semibold',
                isSelected ? 'text-black' : 'text-white'
              )}
            >
              {surveyType.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Single select variant for overlay type
interface OverlayTypeSelectorProps {
  selectedType: SurveyTypeSlug | null;
  onSelect: (type: SurveyTypeSlug) => void;
  className?: string;
}

export function OverlayTypeSelector({
  selectedType,
  onSelect,
  className,
}: OverlayTypeSelectorProps) {
  return (
    <View className={cn('w-full', className)}>
      {SURVEY_TYPES.map((surveyType) => {
        const isSelected = selectedType === surveyType.slug;
        return (
          <Pressable
            key={surveyType.slug}
            onPress={() => onSelect(surveyType.slug)}
            className={cn(
              'flex-row items-center px-5 py-4 mb-3 rounded-xl border-2',
              isSelected
                ? 'bg-white border-white'
                : 'bg-zinc-900 border-zinc-700 active:bg-zinc-800'
            )}
          >
            <View
              className={cn(
                'w-7 h-7 rounded-full items-center justify-center mr-4 border-2',
                isSelected ? 'bg-white border-black' : 'border-zinc-600'
              )}
            >
              {isSelected ? (
                <View className="w-4 h-4 rounded-full bg-black" />
              ) : null}
            </View>
            <Text
              className={cn(
                'text-lg font-semibold',
                isSelected ? 'text-black' : 'text-white'
              )}
            >
              {surveyType.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
