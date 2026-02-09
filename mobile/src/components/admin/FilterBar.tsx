import { ScrollView, View, Text, Pressable } from 'react-native';
import { ChevronDown, X } from 'lucide-react-native';
import { cn } from '@/lib/cn';

export interface FilterOption {
  key: string;
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  allowMultiple?: boolean;
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string | string[]>;
  onChange: (key: string, value: string | string[]) => void;
  className?: string;
}

export function FilterBar({
  filters,
  values,
  onChange,
  className,
}: FilterBarProps) {
  const handleFilterPress = (filterKey: string, optionValue: string, allowMultiple?: boolean) => {
    const currentValue = values[filterKey];

    if (allowMultiple) {
      const currentArray = Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : [];
      if (currentArray.includes(optionValue)) {
        onChange(filterKey, currentArray.filter(v => v !== optionValue));
      } else {
        onChange(filterKey, [...currentArray, optionValue]);
      }
    } else {
      onChange(filterKey, currentValue === optionValue ? '' : optionValue);
    }
  };

  const isSelected = (filterKey: string, optionValue: string): boolean => {
    const currentValue = values[filterKey];
    if (Array.isArray(currentValue)) {
      return currentValue.includes(optionValue);
    }
    return currentValue === optionValue;
  };

  const getActiveFiltersCount = (): number => {
    let count = 0;
    for (const filter of filters) {
      const value = values[filter.key];
      if (Array.isArray(value)) {
        count += value.length;
      } else if (value) {
        count += 1;
      }
    }
    return count;
  };

  const clearAllFilters = () => {
    for (const filter of filters) {
      onChange(filter.key, filter.allowMultiple ? [] : '');
    }
  };

  const activeCount = getActiveFiltersCount();

  return (
    <View className={cn('gap-2', className)}>
      {activeCount > 0 ? (
        <View className="flex-row items-center justify-between px-1">
          <Text className="text-zinc-400 text-sm">
            {activeCount} filter{activeCount !== 1 ? 's' : ''} active
          </Text>
          <Pressable onPress={clearAllFilters} className="flex-row items-center">
            <X size={14} color="#ef4444" />
            <Text className="text-red-500 text-sm ml-1">Clear all</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
      >
        <View className="flex-row gap-3 px-1">
          {filters.map((filter) => (
            <View key={filter.key} className="gap-1.5">
              <Text className="text-zinc-500 text-xs uppercase tracking-wider">
                {filter.label}
              </Text>
              <View className="flex-row gap-1.5">
                {filter.options.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => handleFilterPress(filter.key, option.value, filter.allowMultiple)}
                    className={cn(
                      'px-3 py-1.5 rounded-md',
                      isSelected(filter.key, option.value)
                        ? 'bg-blue-600'
                        : 'bg-zinc-800'
                    )}
                  >
                    <Text
                      className={cn(
                        'text-sm',
                        isSelected(filter.key, option.value)
                          ? 'text-white font-medium'
                          : 'text-zinc-400'
                      )}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
