import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { Calendar, ChevronDown, X } from 'lucide-react-native';
import { cn } from '@/lib/cn';

export type DateRangePreset = 'today' | '7days' | '30days' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  startDate: Date;
  endDate: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function getPresetDateRange(preset: DateRangePreset): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return {
        preset,
        startDate: today,
        endDate: now,
      };
    case '7days':
      return {
        preset,
        startDate: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
        endDate: now,
      };
    case '30days':
      return {
        preset,
        startDate: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000),
        endDate: now,
      };
    case 'custom':
    default:
      return {
        preset: 'custom',
        startDate: today,
        endDate: now,
      };
  }
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [showModal, setShowModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  const presets: { key: DateRangePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7days', label: 'Last 7 Days' },
    { key: '30days', label: 'Last 30 Days' },
    { key: 'custom', label: 'Custom' },
  ];

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowModal(true);
    } else {
      onChange(getPresetDateRange(preset));
    }
  };

  const formatDateDisplay = () => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (value.preset === 'today') {
      return 'Today';
    }
    const start = value.startDate.toLocaleDateString('en-US', options);
    const end = value.endDate.toLocaleDateString('en-US', options);
    return `${start} - ${end}`;
  };

  // Simple calendar day selection for custom range
  const generateCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Padding for days before the 1st
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarDays = generateCalendarDays(calendarMonth);

  const handleDayPress = (day: Date) => {
    if (!customStartDate || (customStartDate && customEndDate)) {
      setCustomStartDate(day);
      setCustomEndDate(null);
    } else {
      if (day < customStartDate) {
        setCustomEndDate(customStartDate);
        setCustomStartDate(day);
      } else {
        setCustomEndDate(day);
      }
    }
  };

  const handleApplyCustomRange = () => {
    if (customStartDate && customEndDate) {
      onChange({
        preset: 'custom',
        startDate: customStartDate,
        endDate: new Date(customEndDate.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000),
      });
      setShowModal(false);
    }
  };

  const isDayInRange = (day: Date) => {
    if (!customStartDate) return false;
    if (!customEndDate) return day.getTime() === customStartDate.getTime();
    return day >= customStartDate && day <= customEndDate;
  };

  const isDayStart = (day: Date) => {
    return customStartDate && day.getTime() === customStartDate.getTime();
  };

  const isDayEnd = (day: Date) => {
    return customEndDate && day.getTime() === customEndDate.getTime();
  };

  const monthName = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View className={cn('flex-row', className)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
      >
        <View className="flex-row gap-2 px-1">
          {presets.map((preset) => (
            <Pressable
              key={preset.key}
              onPress={() => handlePresetSelect(preset.key)}
              className={cn(
                'px-4 py-2 rounded-lg flex-row items-center',
                value.preset === preset.key
                  ? 'bg-blue-600'
                  : 'bg-zinc-800'
              )}
            >
              {preset.key === 'custom' ? (
                <Calendar size={14} color={value.preset === preset.key ? '#fff' : '#a1a1aa'} />
              ) : null}
              <Text
                className={cn(
                  'text-sm font-medium',
                  preset.key === 'custom' ? 'ml-1' : null,
                  value.preset === preset.key
                    ? 'text-white'
                    : 'text-zinc-400'
                )}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-zinc-900 rounded-t-3xl">
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
              <Text className="text-xl font-bold text-white">Select Date Range</Text>
              <Pressable onPress={() => setShowModal(false)} className="p-2">
                <X size={24} color="#a1a1aa" />
              </Pressable>
            </View>

            {/* Month Navigation */}
            <View className="flex-row items-center justify-between px-6 py-4">
              <Pressable
                onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                className="p-2"
              >
                <ChevronDown size={24} color="#a1a1aa" style={{ transform: [{ rotate: '90deg' }] }} />
              </Pressable>
              <Text className="text-white font-semibold">{monthName}</Text>
              <Pressable
                onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                className="p-2"
              >
                <ChevronDown size={24} color="#a1a1aa" style={{ transform: [{ rotate: '-90deg' }] }} />
              </Pressable>
            </View>

            {/* Day Labels */}
            <View className="flex-row px-4">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <View key={d} className="flex-1 items-center py-2">
                  <Text className="text-zinc-500 text-xs font-medium">{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid */}
            <View className="flex-row flex-wrap px-4 pb-4">
              {calendarDays.map((day, idx) => (
                <View key={idx} className="w-[14.28%] aspect-square p-1">
                  {day ? (
                    <Pressable
                      onPress={() => handleDayPress(day)}
                      className={cn(
                        'flex-1 items-center justify-center rounded-lg',
                        isDayInRange(day) ? 'bg-blue-600/30' : null,
                        isDayStart(day) || isDayEnd(day) ? 'bg-blue-600' : null
                      )}
                    >
                      <Text
                        className={cn(
                          'text-sm',
                          isDayInRange(day) ? 'text-white' : 'text-zinc-300',
                          isDayStart(day) || isDayEnd(day) ? 'font-bold' : null
                        )}
                      >
                        {day.getDate()}
                      </Text>
                    </Pressable>
                  ) : (
                    <View className="flex-1" />
                  )}
                </View>
              ))}
            </View>

            {/* Selected Range Display */}
            <View className="px-6 pb-4">
              <Text className="text-zinc-400 text-center mb-4">
                {customStartDate
                  ? customEndDate
                    ? `${customStartDate.toLocaleDateString()} - ${customEndDate.toLocaleDateString()}`
                    : `${customStartDate.toLocaleDateString()} - Select end date`
                  : 'Select start date'}
              </Text>
            </View>

            {/* Apply Button */}
            <View className="px-6 pb-8">
              <Pressable
                onPress={handleApplyCustomRange}
                disabled={!customStartDate || !customEndDate}
                className={cn(
                  'h-14 rounded-xl items-center justify-center',
                  customStartDate && customEndDate
                    ? 'bg-blue-600 active:bg-blue-700'
                    : 'bg-zinc-700'
                )}
              >
                <Text
                  className={cn(
                    'font-semibold text-lg',
                    customStartDate && customEndDate ? 'text-white' : 'text-zinc-500'
                  )}
                >
                  Apply
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
