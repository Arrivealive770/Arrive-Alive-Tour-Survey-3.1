import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Lock, ArrowLeft } from 'lucide-react-native';
import { cn } from '@/lib/cn';

// Admin password - in production this should be stored securely
const ADMIN_PASSWORD = 'admin123';

export default function AdminLoginScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      router.replace('/admin/dashboard' as any);
    } else {
      setError(true);
      Alert.alert('Invalid Password', 'Please enter the correct admin password.');
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-8 pt-8">
        {/* Back Button */}
        <Pressable
          onPress={handleBack}
          className="flex-row items-center mb-8"
        >
          <ArrowLeft size={24} color="#71717a" />
          <Text className="text-zinc-500 ml-2">Back</Text>
        </Pressable>

        {/* Header */}
        <View className="items-center mb-12">
          <View className="w-20 h-20 rounded-full bg-zinc-800 items-center justify-center mb-6">
            <Lock size={40} color="#fff" />
          </View>
          <Text className="text-3xl font-bold text-white mb-2">
            Admin Access
          </Text>
          <Text className="text-zinc-400 text-center">
            Enter the admin password to manage events and view survey data
          </Text>
        </View>

        {/* Password Input */}
        <View className="mb-8">
          <Text className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(false);
            }}
            placeholder="Enter admin password"
            placeholderTextColor="#666"
            secureTextEntry
            autoCapitalize="none"
            className={cn(
              'w-full h-16 px-5 text-lg text-white bg-zinc-900 rounded-xl',
              'border-2',
              error ? 'border-red-500' : 'border-zinc-700'
            )}
          />
          {error ? (
            <Text className="text-red-500 mt-2">Incorrect password</Text>
          ) : null}
        </View>

        {/* Login Button */}
        <Pressable
          onPress={handleLogin}
          disabled={!password}
          className={cn(
            'w-full h-16 rounded-xl items-center justify-center',
            password ? 'bg-white active:bg-zinc-200' : 'bg-zinc-800'
          )}
        >
          <Text
            className={cn(
              'text-xl font-bold',
              password ? 'text-black' : 'text-zinc-500'
            )}
          >
            Login
          </Text>
        </Pressable>

        {/* Help Text */}
        <View className="flex-1 justify-end pb-8">
          <Text className="text-center text-zinc-600 text-sm">
            Contact your administrator if you don't know the password
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
