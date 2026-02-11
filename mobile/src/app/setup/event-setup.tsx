import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SurveyTypeSelector, OverlayTypeSelector, StateDropdown } from '@/components/setup';
import { useDeviceStore } from '@/lib/state/device-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { api } from '@/lib/api/api';
import { cn } from '@/lib/cn';
import type { Event, CreateEventRequest, SurveyTypeSlug, Team } from '@/lib/api/types';

export default function EventSetupScreen() {
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [surveyTypes, setSurveyTypes] = useState<SurveyTypeSlug[]>([]);
  const [overlayType, setOverlayType] = useState<SurveyTypeSlug | null>(null);

  const teamId = useDeviceStore((s) => s.teamId);
  const teamCode = useDeviceStore((s) => s.teamCode);
  const deviceType = useDeviceStore((s) => s.deviceType);
  const setCurrentEventId = useDeviceStore((s) => s.setCurrentEvent);

  const { db } = useDatabase();

  // Fetch team name
  const { data: team } = useQuery({
    queryKey: ['team', teamCode],
    queryFn: () => api.get<Team>(`/api/teams/code/${teamCode}`),
    enabled: !!teamCode,
  });

  const createEventMutation = useMutation({
    mutationFn: async () => {
      const request: CreateEventRequest = {
        teamId: teamId!,
        venueName,
        venueCity: city,
        venueState: state,
        eventDate: new Date().toISOString(),
        surveyTypes,
        overlayType: overlayType!,
      };
      const event = await api.post<Event>('/api/events', request);
      return event;
    },
    onSuccess: async (event) => {
      // Store event in device store
      setCurrentEventId(event.id);

      // Store event in local database
      if (db) {
        await db.setCurrentEvent({
          eventId: event.id,
          teamId: event.teamId,
          teamCode: teamCode,
          venueName: event.venueName,
          surveyTypes: JSON.stringify(event.surveyTypes),
          overlayType: event.overlayType,
          activeSurveyType: event.surveyTypes[0] || null,
          startedAt: event.eventDate,
        });
      }

      // Navigate based on device type
      if (deviceType === 'tablet') {
        router.replace('/kiosk' as any);
      } else {
        router.replace('/photo-hub' as any);
      }
    },
    onError: (err: Error) => {
      console.error('Failed to create event:', err);
    },
  });

  const handleToggleSurveyType = (type: SurveyTypeSlug) => {
    setSurveyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleStartEvent = () => {
    createEventMutation.mutate();
  };

  const isLoading = createEventMutation.isPending;
  const isValid =
    venueName.trim() !== '' &&
    city.trim() !== '' &&
    state !== '' &&
    surveyTypes.length > 0 &&
    overlayType !== null;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 48, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-white mb-2">
            Event Setup
          </Text>
          {team ? (
            <Text className="text-lg text-zinc-400">Team: {team.name}</Text>
          ) : null}
        </View>

        {/* Venue Name */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
            Venue Name
          </Text>
          <TextInput
            value={venueName}
            onChangeText={setVenueName}
            placeholder="Enter venue name"
            placeholderTextColor="#666"
            className="w-full h-16 px-5 text-lg text-white bg-zinc-900 border-2 border-zinc-700 rounded-xl"
          />
        </View>

        {/* City */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
            City
          </Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Enter city"
            placeholderTextColor="#666"
            className="w-full h-16 px-5 text-lg text-white bg-zinc-900 border-2 border-zinc-700 rounded-xl"
          />
        </View>

        {/* State */}
        <View className="mb-8">
          <Text className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
            State
          </Text>
          <StateDropdown value={state} onSelect={setState} />
        </View>

        {/* Survey Types */}
        <View className="mb-8">
          <Text className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
            Survey Types
          </Text>
          <Text className="text-sm text-zinc-500 mb-4">
            Select which surveys will be available at this event
          </Text>
          <SurveyTypeSelector
            selectedTypes={surveyTypes}
            onToggle={handleToggleSurveyType}
          />
        </View>

        {/* Overlay Type */}
        <View className="mb-10">
          <Text className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
            Photo Overlay Type
          </Text>
          <Text className="text-sm text-zinc-500 mb-4">
            Select the overlay style for pledge photos
          </Text>
          <OverlayTypeSelector
            selectedType={overlayType}
            onSelect={setOverlayType}
          />
        </View>

        {/* Start Event Button */}
        <Pressable
          onPress={handleStartEvent}
          disabled={!isValid || isLoading}
          className={cn(
            'w-full h-16 rounded-xl items-center justify-center mb-8',
            isValid && !isLoading
              ? 'bg-white active:bg-zinc-200'
              : 'bg-zinc-800'
          )}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text
              className={cn(
                'text-xl font-bold',
                isValid ? 'text-black' : 'text-zinc-500'
              )}
            >
              Start Event
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
