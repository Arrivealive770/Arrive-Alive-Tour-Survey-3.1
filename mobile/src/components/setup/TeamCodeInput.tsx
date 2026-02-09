import { TextInput, View, Text } from 'react-native';
import { cn } from '@/lib/cn';

interface TeamCodeInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  placeholder?: string;
  className?: string;
}

export function TeamCodeInput({
  value,
  onChangeText,
  error,
  placeholder = 'Enter team code',
  className,
}: TeamCodeInputProps) {
  const handleChange = (text: string) => {
    // Only allow alphanumeric characters, convert to uppercase
    const sanitized = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    // Limit to 6 characters
    if (sanitized.length <= 6) {
      onChangeText(sanitized);
    }
  };

  return (
    <View className={cn('w-full', className)}>
      <TextInput
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor="#666"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        className={cn(
          'w-full h-20 px-6 text-3xl font-bold text-center text-white',
          'bg-zinc-900 border-2 rounded-xl',
          error ? 'border-red-500' : 'border-zinc-700',
          'tracking-widest'
        )}
      />
      {error ? (
        <Text className="mt-2 text-center text-red-500 text-base">{error}</Text>
      ) : null}
      <Text className="mt-2 text-center text-zinc-500 text-sm">
        4-6 character alphanumeric code
      </Text>
    </View>
  );
}
