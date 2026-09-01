import { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Calendar, Check, AlertCircle, ChevronLeft, Clock } from 'lucide-react-native';
import { useDeviceStore } from '@/lib/state/device-store';
import { useDatabase } from '@/providers/DatabaseProvider';
import { api } from '@/lib/api/api';
import { cacheEventOverlay } from '@/lib/overlays/overlay-cache';
import {
  isEventOver,
  isEventRunningLate,
  isEventNotStartedYet,
} from '@/lib/events/event-status';
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

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

  // Only events somebody has actually ended drop off this list. An event that
  // hasn't started yet is here on purpose — crews arrive early to set up — and
  // so is one running past its scheduled end. Soonest first, so the area the
  // crew is heading to next is at the top.
  const selectableEvents = useMemo(() => {
    if (!events) return [];
    return events
      .filter((event) => !isEventOver(event))
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [events]);

  // Auto-select the event on today's date, or one still running from last
  // night that nobody has closed yet.
  useEffect(() => {
    if (selectableEvents.length > 0 && !autoSelected) {
      const todayEvent =
        selectableEvents.find((e) => isToday(e.eventDate)) ??
        selectableEvents.find((e) => isEventRunningLate(e));
      if (todayEvent) {
        setSelectedEventId(todayEvent.id);
        setAutoSelected(true);
      }
    }
  }, [selectableEvents, autoSelected]);

  const handleSelectEvent = async () => {
    if (!selectedEventId) return;

    const event = selectableEvents.find((e) => e.id === selectedEventId);
    if (!event) return;

    // Store event in device store
    setCurrentEventId(event.id);

    // Store picture pledge settings in device store
    setDeviceConfig({
      picturePledgeEnabled: event.picturePledgeEnabled ?? false,
      // overlayId, not the legacy overlayType slug — the slug never named the
      // event's real artwork.
      currentEventOverlayId: event.overlayId || null,
      // Kept so the main menu can name the area, and so the event watcher can
      // tell that this event is over without needing a connection.
      currentEventVenue: event.venueName,
      currentEventDate: event.eventDate,
      currentEventEndAt: event.eventEndAt ?? null,
      currentEventStatus: event.status,
    });

    // Pull the event's frame down now, while the device is provably online —
    // this screen only loads with a connection. Waiting until the camera is
    // opened means downloading it at the venue, which is exactly where the
    // signal is worst. Deliberately not awaited: a slow download should not
    // hold up starting the event, and the camera falls back to fetching it.
    cacheEventOverlay(event.id).catch((err: unknown) => {
      console.log('[EventSetup] Could not pre-download overlay:', err);
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

  const selectedEvent = selectableEvents.find((e) => e.id === selectedEventId);
  const todayCount = selectableEvents.filter((e) => isToday(e.eventDate)).length;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-8 pt-6">
        {/* Back to the main menu. Switching areas mid-tour is a normal thing to
            change your mind about, so this must never be a dead end. */}
        <Pressable
          onPress={() => router.replace('/' as any)}
          hitSlop={12}
          className="flex-row items-center self-start py-2 mb-2 active:opacity-60"
        >
          <ChevronLeft size={22} color="#3b82f6" />
          <Text className="text-blue-500 text-base font-semibold ml-1">Menu</Text>
        </Pressable>

        {/* Header */}
        <View className="mb-6">
          <Text className="text-4xl font-bold text-white mb-2">Select Event Area</Text>
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
          ) : selectableEvents.length > 0 ? (
            <View className="mb-6">
              {todayCount === 0 ? (
                <View className="flex-row items-center bg-amber-500/10 p-4 rounded-xl mb-6">
                  <AlertCircle size={24} color="#f59e0b" />
                  <Text className="text-amber-500 ml-3 flex-1">
                    No event scheduled for today. You can still open an upcoming event below and
                    set up early.
                  </Text>
                </View>
              ) : null}

              <View className="gap-3">
                {selectableEvents.map((event) => {
                  const today = isToday(event.eventDate);
                  const isSelected = selectedEventId === event.id;
                  const notStartedYet = isEventNotStartedYet(event);
                  const runningLate = isEventRunningLate(event);

                  return (
                    <Pressable
                      key={event.id}
                      onPress={() => setSelectedEventId(event.id)}
                      className={cn(
                        'p-5 rounded-2xl border-2',
                        isSelected
                          ? today
                            ? 'bg-green-500/10 border-green-500'
                            : 'bg-white/10 border-white'
                          : 'bg-zinc-900 border-zinc-700'
                      )}
                    >
                      {today || runningLate || notStartedYet ? (
                        <View className="flex-row items-center flex-wrap gap-2 mb-3">
                          {today ? (
                            <View className="bg-green-500 px-3 py-1 rounded-full">
                              <Text className="text-white text-sm font-bold">TODAY</Text>
                            </View>
                          ) : null}
                          {runningLate ? (
                            <View className="bg-amber-500 px-3 py-1 rounded-full">
                              <Text className="text-white text-sm font-bold">RUNNING LATE</Text>
                            </View>
                          ) : null}
                          {notStartedYet ? (
                            <View className="bg-blue-600 px-3 py-1 rounded-full">
                              <Text className="text-white text-sm font-bold">
                                STARTS {formatTime(event.eventDate)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}

                      <Text className="text-2xl font-bold text-white mb-2 pr-10">
                        {event.venueName}
                      </Text>

                      <View className="flex-row items-center mb-2">
                        <MapPin size={16} color="#71717a" />
                        <Text className="text-zinc-400 ml-2 text-base">
                          {event.venueCity}, {event.venueState}
                        </Text>
                      </View>

                      <View className="flex-row items-center flex-wrap mb-4">
                        <Calendar size={16} color="#71717a" />
                        <Text className="text-zinc-400 ml-2">
                          {new Date(event.eventDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Text>
                        <Text className="text-zinc-600 mx-2">•</Text>
                        <Clock size={14} color="#71717a" />
                        <Text className="text-zinc-400 ml-1.5">
                          {formatTime(event.eventDate)}
                          {event.eventEndAt ? ` – ${formatTime(event.eventEndAt)}` : ''}
                        </Text>
                      </View>

                      {/* Survey Types */}
                      <View className="flex-row flex-wrap gap-2">
                        {event.surveyTypes.map((type) => (
                          <View key={type} className="bg-zinc-800 px-3 py-1.5 rounded-lg">
                            <Text className="text-zinc-300 text-sm capitalize">{type}</Text>
                          </View>
                        ))}
                      </View>

                      {isSelected ? (
                        <View
                          className={cn(
                            'absolute top-4 right-4 w-8 h-8 rounded-full items-center justify-center',
                            today ? 'bg-green-500' : 'bg-white'
                          )}
                        >
                          <Check size={20} color={today ? '#fff' : '#000'} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View className="items-center py-12">
              <AlertCircle size={48} color="#71717a" />
              <Text className="text-zinc-400 text-lg mt-4 mb-2">No events available</Text>
              <Text className="text-zinc-500 text-center">
                Every event has been ended. Contact your home office to create the next one.
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
