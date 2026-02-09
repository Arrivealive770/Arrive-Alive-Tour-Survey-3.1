import { useState } from 'react';
import { Pressable, View, Text, Modal, FlatList } from 'react-native';
import { cn } from '@/lib/cn';
import { ChevronDown, Check } from 'lucide-react-native';
import { US_STATES } from '@/lib/api/types';
import { SafeAreaView } from 'react-native-safe-area-context';

interface StateDropdownProps {
  value: string;
  onSelect: (state: string) => void;
  placeholder?: string;
  className?: string;
}

export function StateDropdown({
  value,
  onSelect,
  placeholder = 'Select state',
  className,
}: StateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedState = US_STATES.find((s) => s.code === value);

  const handleSelect = (code: string) => {
    onSelect(code);
    setIsOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        className={cn(
          'flex-row items-center justify-between w-full h-16 px-5',
          'bg-zinc-900 border-2 border-zinc-700 rounded-xl',
          'active:bg-zinc-800',
          className
        )}
      >
        <Text
          className={cn(
            'text-lg',
            selectedState ? 'text-white font-semibold' : 'text-zinc-500'
          )}
        >
          {selectedState ? selectedState.name : placeholder}
        </Text>
        <ChevronDown size={24} color="#a1a1aa" />
      </Pressable>

      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
            <Text className="text-xl font-bold text-white">Select State</Text>
            <Pressable
              onPress={() => setIsOpen(false)}
              className="px-4 py-2 rounded-lg active:bg-zinc-800"
            >
              <Text className="text-white font-semibold">Done</Text>
            </Pressable>
          </View>

          <FlatList
            data={US_STATES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const isSelected = item.code === value;
              return (
                <Pressable
                  onPress={() => handleSelect(item.code)}
                  className={cn(
                    'flex-row items-center justify-between px-5 py-4',
                    'border-b border-zinc-900',
                    isSelected ? 'bg-zinc-800' : 'active:bg-zinc-900'
                  )}
                >
                  <Text
                    className={cn(
                      'text-lg',
                      isSelected ? 'text-white font-bold' : 'text-zinc-300'
                    )}
                  >
                    {item.name}
                  </Text>
                  {isSelected ? (
                    <Check size={24} color="#fff" strokeWidth={2.5} />
                  ) : null}
                </Pressable>
              );
            }}
            showsVerticalScrollIndicator={true}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}
