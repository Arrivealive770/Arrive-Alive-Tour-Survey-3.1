import { Pressable, View, Text } from 'react-native';
import { cn } from '@/lib/cn';
import { LucideIcon } from 'lucide-react-native';

interface DeviceRoleCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  selected?: boolean;
  onPress: () => void;
  className?: string;
}

export function DeviceRoleCard({
  title,
  description,
  icon: Icon,
  selected = false,
  onPress,
  className,
}: DeviceRoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'w-full p-8 rounded-2xl border-2',
        selected
          ? 'bg-white border-white'
          : 'bg-zinc-900 border-zinc-700 active:bg-zinc-800',
        className
      )}
    >
      <View className="items-center">
        <View
          className={cn(
            'w-20 h-20 rounded-full items-center justify-center mb-4',
            selected ? 'bg-black' : 'bg-zinc-800'
          )}
        >
          <Icon
            size={40}
            color={selected ? '#fff' : '#a1a1aa'}
            strokeWidth={1.5}
          />
        </View>
        <Text
          className={cn(
            'text-2xl font-bold mb-2',
            selected ? 'text-black' : 'text-white'
          )}
        >
          {title}
        </Text>
        <Text
          className={cn(
            'text-base text-center',
            selected ? 'text-zinc-600' : 'text-zinc-400'
          )}
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}
