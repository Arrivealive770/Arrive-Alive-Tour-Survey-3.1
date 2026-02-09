import { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Keyboard } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import { Mail, AlertCircle } from 'lucide-react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface EmailInputProps {
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
}

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailInput({ value, onChangeText, autoFocus = false }: EmailInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasBeenTouched, setHasBeenTouched] = useState(false);

  const isValid = useMemo(() => EMAIL_REGEX.test(value), [value]);
  const showError = hasBeenTouched && value.length > 0 && !isValid;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setHasBeenTouched(true);
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text.toLowerCase().trim());
    },
    [onChangeText]
  );

  return (
    <View style={{ width: '100%' }}>
      {/* Input Container */}
      <View
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: 16,
          borderWidth: 2,
          borderColor: showError ? '#ef4444' : isFocused ? '#22c55e' : '#27272a',
          paddingHorizontal: 20,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 70,
        }}
      >
        <Mail
          size={24}
          color={showError ? '#ef4444' : isFocused ? '#22c55e' : '#71717a'}
          style={{ marginRight: 16 }}
        />
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="email@example.com"
          placeholderTextColor="#52525b"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          autoFocus={autoFocus}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={{
            flex: 1,
            fontSize: 20,
            color: '#ffffff',
            padding: 0,
          }}
        />
      </View>

      {/* Error Message */}
      {showError ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 8,
            paddingHorizontal: 4,
          }}
        >
          <AlertCircle size={16} color="#ef4444" style={{ marginRight: 6 }} />
          <Text style={{ color: '#ef4444', fontSize: 14 }}>
            Please enter a valid email address
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// Helper hook for email validation
export function useEmailValidation(email: string): { isValid: boolean; errorMessage: string | null } {
  return useMemo(() => {
    if (!email || email.length === 0) {
      return { isValid: false, errorMessage: null };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { isValid: false, errorMessage: 'Please enter a valid email address' };
    }
    return { isValid: true, errorMessage: null };
  }, [email]);
}
