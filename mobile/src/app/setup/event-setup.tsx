import { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Calendar, Check, AlertCircle } from 'lucide-react-native';
import { useDeviceStore } from '@/lib/state/device-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { api } from '@/lib/api/api';
import { cn } from '@/lib/cn';
import type { Event, Team } from '@/lib/api/types';

// Helper to check if event date is today
function isToday(dateString: string): boolean {
  const eventDate = new Date(dateString);
  const today = new Date();
  return (
    eventDate.getFullYear() === today.getFullYear() &&
    eventDate.getMonth() === today.getMonth() &&
    eventDate.getDate() === today.getDate()
  );
}

export default function EventSetupScreen() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);

  const teamId = useDeviceStore((s) => s.teamId);
  const teamCode = useDeviceStore((s) => s.teamCode);
  const deviceType = useDeviceStore((s) => s.deviceType);
  const setCurrentEventId = useDeviceStore((s) => s.setCurrentEvent);
  const setDeviceConfig = useDeviceStore((s) => s.setDeviceConfig);

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

  // Auto-select today's event
  useEffect(() => {
    if (events && events.length > 0 && !autoSelected) {
      // Find event for today
      const todayEvent = events.find(e => isToday(e.eventDate));
      if (todayEvent) {
        setSelectedEventId(todayEvent.id);
        setAutoSelected(true);
      }
    }
  }, [events, autoSelected]);

  const handleSelectEvent = async () => {
    if (!selectedEventId || !events) return;

    const event = events.find(e => e.id === selectedEventId);
    if (!event) return;

    // Store event in device store
    setCurrentEventId(event.id);

    // Store picture pledge settings in device store
    setDeviceConfig({
      picturePledgeEnabled: event.picturePledgeEnabled ?? false,
      currentEventOverlayId: event.overlayType || null,
    });

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
  const todayEvent = events?.find(e => isToday(e.eventDate));

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-8 pt-16">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-4xl font-bold text-white mb-2">
            Today's Event
          </Text>
          {team ? (
            <Text className="text-lg text-zinc-400">Team: {team.name}</Text>
          ) : null}
        </View>

        {/* Content */}
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
          ) : todayEvent ? (
            // Show today's event prominently
            <View className="mb-6">
              <Pressable
                onPress={() => setSelectedEventId(todayEvent.id)}
                className={cn(
                  'p-6 rounded-2xl border-2',
                  selectedEventId === todayEvent.id
                    ? 'bg-green-500/10 border-green-500'
                    : 'bg-zinc-900 border-zinc-700'
                )}
              >
                <View className="flex-row items-center mb-3">
                  <View className="bg-green-500 px-3 py-1 rounded-full">
                    <Text className="text-white text-sm font-bold">TODAY</Text>
                  </View>
                </View>
                <Text className="text-2xl font-bold text-white mb-2">
                  {todayEvent.venueName}
                </Text>
                <View className="flex-row items-center mb-2">
                  <MapPin size={16} color="#71717a" />
                  <Text className="text-zinc-400 ml-2 text-lg">
                    {todayEvent.venueCity}, {todayEvent.venueState}
                  </Text>
                </View>
                <View className="flex-row items-center mb-4">
                  <Calendar size={16} color="#71717a" />
                  <Text className="text-zinc-400 ml-2">
                    {new Date(todayEvent.eventDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                {/* Survey Types */}
                <View className="flex-row flex-wrap gap-2">
                  {todayEvent.surveyTypes.map((type) => (
                    <View key={type} className="bg-zinc-800 px-3 py-1.5 rounded-lg">
                      <Text className="text-zinc-300 text-sm capitalize">{type}</Text>
                    </View>
                  ))}
                </View>
                {selectedEventId === todayEvent.id ? (
                  <View className="absolute top-4 right-4 w-8 h-8 rounded-full bg-green-500 items-center justify-center">
                    <Check size={20} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            </View>
          ) : events && events.length > 0 ? (
            // No event for today, but other events exist
            <View className="mb-6">
              <View className="flex-row items-center bg-amber-500/10 p-4 rounded-xl mb-6">
                <AlertCircle size={24} color="#f59e0b" />
                <Text className="text-amber-500 ml-3 flex-1">
                  No event scheduled for today. Select an upcoming event below.
                </Text>
              </View>

              <Text className="text-zinc-400 text-sm uppercase tracking-wide mb-3">
                Upcoming Events
              </Text>
              <View className="gap-3">
                {events.map((event) => (
                  <Pressable
                    key={event.id}
                    onPress={() => setSelectedEventId(event.id)}
                    className={cn(
                      'p-4 rounded-xl border-2',
                      selectedEventId === event.id
                        ? 'bg-white/10 border-white'
                        : 'bg-zinc-900 border-zinc-700'
                    )}
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1">
                        <Text className="text-lg font-bold text-white mb-1">
                          {event.venueName}
                        </Text>
                        <View className="flex-row items-center">
                          <MapPin size={12} color="#71717a" />
                          <Text className="text-zinc-500 ml-1 text-sm">
                            {event.venueCity}, {event.venueState}
                          </Text>
                          <Text className="text-zinc-600 mx-2">•</Text>
                          <Calendar size={12} color="#71717a" />
                          <Text className="text-zinc-500 ml-1 text-sm">
                            {new Date(event.eventDate).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      {selectedEventId === event.id ? (
                        <View className="w-6 h-6 rounded-full bg-white items-center justify-center">
                          <Check size={16} color="#000" />
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View className="items-center py-12">
              <AlertCircle size={48} color="#71717a" />
              <Text className="text-zinc-400 text-lg mt-4 mb-2">No events scheduled</Text>
              <Text className="text-zinc-500 text-center">
                Contact your home office to create an event for today.
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
              Start Event
            </Text>
          </Pressable>

          {selectedEvent ? (
            <Text className="text-zinc-500 text-center mt-3">
              {selectedEvent.surveyTypes.length} survey type{selectedEvent.surveyTypes.length > 1 ? 's' : ''}: {selectedEvent.surveyTypes.join(', ')}
            </Text>
          ) : (
            <Text className="text-zinc-600 text-center mt-3">
              Pull down to refresh
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
