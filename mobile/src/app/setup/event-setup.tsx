import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Calendar, Check } from 'lucide-react-native';
import { useDeviceStore } from '@/lib/state/device-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { api } from '@/lib/api/api';
import { cn } from '@/lib/cn';
import type { Event, Team } from '@/lib/api/types';

export default function EventSetupScreen() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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

  // Fetch active events for this team
  const { data: events, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['events', teamId],
    queryFn: () => api.get<Event[]>(`/api/events?teamId=${teamId}&status=active`),
    enabled: !!teamId,
  });

  const handleSelectEvent = async () => {
    if (!selectedEventId || !events) return;

    const event = events.find(e => e.id === selectedEventId);
    if (!event) return;

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
  };

  const selectedEvent = events?.find(e => e.id === selectedEventId);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-8 pt-16">
        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-white mb-2">
            Select Event
          </Text>
          {team ? (
            <Text className="text-lg text-zinc-400">Team: {team.name}</Text>
          ) : null}
        </View>

        {/* Events List */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor="#3b82f6"
            />
          }
        >
          {isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color="#fff" />
              <Text className="text-zinc-400 mt-4">Loading events...</Text>
            </View>
          ) : events && events.length > 0 ? (
            <View className="gap-4 pb-8">
              {events.map((event) => (
                <Pressable
                  key={event.id}
                  onPress={() => setSelectedEventId(event.id)}
                  className={cn(
                    'p-5 rounded-2xl border-2',
                    selectedEventId === event.id
                      ? 'bg-white/10 border-white'
                      : 'bg-zinc-900 border-zinc-700'
                  )}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-xl font-bold text-white mb-2">
                        {event.venueName}
                      </Text>
                      <View className="flex-row items-center mb-2">
                        <MapPin size={14} color="#71717a" />
                        <Text className="text-zinc-400 ml-1">
                          {event.venueCity}, {event.venueState}
                        </Text>
                      </View>
                      <View className="flex-row items-center mb-3">
                        <Calendar size={14} color="#71717a" />
                        <Text className="text-zinc-400 ml-1">
                          {new Date(event.eventDate).toLocaleDateString()}
                        </Text>
                      </View>
                      {/* Survey Types */}
                      <View className="flex-row flex-wrap gap-2">
                        {event.surveyTypes.map((type) => (
                          <View key={type} className="bg-zinc-800 px-2 py-1 rounded">
                            <Text className="text-zinc-300 text-xs capitalize">{type}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    {selectedEventId === event.id ? (
                      <View className="w-8 h-8 rounded-full bg-white items-center justify-center">
                        <Check size={20} color="#000" />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-zinc-400 text-lg mb-2">No active events</Text>
              <Text className="text-zinc-500 text-center">
                Contact your home office to create an event for this location.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Join Event Button */}
        <View className="pb-8 pt-4">
          <Pressable
            onPress={handleSelectEvent}
            disabled={!selectedEventId}
            className={cn(
              'w-full h-16 rounded-xl items-center justify-center',
              selectedEventId
                ? 'bg-white active:bg-zinc-200'
                : 'bg-zinc-800'
            )}
          >
            <Text
              className={cn(
                'text-xl font-bold',
                selectedEventId ? 'text-black' : 'text-zinc-500'
              )}
            >
              Join Event
            </Text>
          </Pressable>

          {selectedEvent ? (
            <Text className="text-zinc-500 text-center mt-3">
              You'll be collecting {selectedEvent.surveyTypes.length} survey type{selectedEvent.surveyTypes.length > 1 ? 's' : ''} at this event
            </Text>
          ) : (
            <Text className="text-zinc-600 text-center mt-3">
              Pull down to refresh the event list
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
