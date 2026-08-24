import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { TeamCodeInput } from '@/components/setup';
import { useDeviceStore, type CodeType } from '@/lib/state/device-store';
import { api } from '@/lib/api/api';
import type { Team } from '@/lib/api/types';

const AATLogo = require('@/assets/aat-logo.png');

export default function TeamSelectionScreen() {
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setDeviceConfig = useDeviceStore((s) => s.setDeviceConfig);

  const verifyTeamMutation = useMutation({
    mutationFn: async (code: string) => {
      const team = await api.get<Team>(`/api/teams/code/${code}`);
      return team;
    },
    onSuccess: (team) => {
      // Store team info in device store including codeType
      setDeviceConfig({
        teamId: team.id,
        teamCode: team.code,
        codeType: (team.codeType || 'tablet') as CodeType,
        // Whether this team is allowed into Admin at all.
        isAdminTeam: !!team.isAdminTeam,
      });
      // Navigate to device config
      router.push('/setup/device-config' as any);
    },
    onError: (err: Error) => {
      setError('Invalid team code. Please try again.');
    },
  });

  const handleConnect = () => {
    if (teamCode.length < 4) {
      setError('Team code must be at least 4 characters');
      return;
    }
    setError(null);
    verifyTeamMutation.mutate(teamCode);
  };

  const isLoading = verifyTeamMutation.isPending;
  const isValid = teamCode.length >= 4;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-8 pt-8">
        {/* Logo */}
        <View className="items-center mb-8">
          <Image
            source={AATLogo}
            style={{ width: 200, height: 100 }}
            resizeMode="contain"
          />
        </View>

        {/* Header */}
        <View className="mb-12">
          <Text className="text-4xl font-bold text-white mb-2">
            Setup Device
          </Text>
          <Text className="text-lg text-zinc-400">
            Enter your team code to connect this device
          </Text>
        </View>

        {/* Team Code Input */}
        <View className="mb-8">
          <TeamCodeInput
            value={teamCode}
            onChangeText={(text) => {
              setTeamCode(text);
              setError(null);
            }}
            error={error}
          />
        </View>

        {/* Connect Button */}
        <Pressable
          onPress={handleConnect}
          disabled={!isValid || isLoading}
          className={`w-full h-16 rounded-xl items-center justify-center ${
            isValid && !isLoading
              ? 'bg-white active:bg-zinc-200'
              : 'bg-zinc-800'
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text
              className={`text-xl font-bold ${
                isValid ? 'text-black' : 'text-zinc-500'
              }`}
            >
              Connect to Team
            </Text>
          )}
        </Pressable>

        {/* Footer */}
        <View className="flex-1 justify-end pb-8">
          <Text className="text-center text-zinc-600 text-sm">
            Contact your team administrator if you don't have a team code
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
