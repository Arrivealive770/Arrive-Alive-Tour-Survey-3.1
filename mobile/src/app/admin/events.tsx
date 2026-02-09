import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Plus, X, MapPin, Check } from 'lucide-react-native';
import { EventCard } from '@/components/admin/EventCard';
import { useDeviceStore } from '@/lib/state/device-store';
import { SURVEY_TYPES, US_STATES, type SurveyTypeSlug, type Event } from '@/lib/api/types';
import { cn } from '@/lib/cn';

// Mock events for demonstration
const MOCK_EVENTS: Event[] = [
  {
    id: '1',
    teamId: 'team-1',
    venueName: 'Central High School',
    city: 'Austin',
    state: 'TX',
    surveyTypes: ['marijuana', 'alcohol', 'distracted'],
    overlayType: 'marijuana',
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    teamId: 'team-1',
    venueName: 'Westside Community Center',
    city: 'Houston',
    state: 'TX',
    surveyTypes: ['alcohol', 'impaired'],
    overlayType: 'alcohol',
    status: 'completed',
    startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    teamId: 'team-1',
    venueName: 'Lincoln Academy',
    city: 'Dallas',
    state: 'TX',
    surveyTypes: ['distracted', 'combo'],
    overlayType: 'distracted',
    status: 'completed',
    startedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    endedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Mock survey counts
const MOCK_SURVEY_COUNTS: Record<string, number> = {
  '1': 47,
  '2': 123,
  '3': 89,
};

const MOCK_PLEDGE_COUNTS: Record<string, number> = {
  '1': 32,
  '2': 98,
  '3': 67,
};

export default function EventsScreen() {
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // New event form state
  const [newVenueName, setNewVenueName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newSurveyTypes, setNewSurveyTypes] = useState<SurveyTypeSlug[]>([]);
  const [newOverlayType, setNewOverlayType] = useState<SurveyTypeSlug | ''>('');

  const teamId = useDeviceStore((s) => s.teamId);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // In real app, would fetch events from API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  }, []);

  const handleEventPress = (event: Event) => {
    setSelectedEvent(event);
  };

  const handleEndEvent = (eventId: string) => {
    Alert.alert(
      'End Event',
      'Are you sure you want to end this event? This will mark it as completed and purge local data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Event',
          style: 'destructive',
          onPress: () => {
            // In real app, would call API
            setEvents((prev) =>
              prev.map((e) =>
                e.id === eventId
                  ? { ...e, status: 'completed' as const, endedAt: new Date().toISOString() }
                  : e
              )
            );
            setSelectedEvent(null);
          },
        },
      ]
    );
  };

  const handleCreateEvent = () => {
    if (!newVenueName || !newCity || !newState || newSurveyTypes.length === 0 || !newOverlayType) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    const newEvent: Event = {
      id: `event-${Date.now()}`,
      teamId: teamId || 'team-1',
      venueName: newVenueName,
      city: newCity,
      state: newState,
      surveyTypes: newSurveyTypes,
      overlayType: newOverlayType,
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null,
      createdAt: new Date().toISOString(),
    };

    setEvents((prev) => [newEvent, ...prev]);
    resetNewEventForm();
    setShowNewEventModal(false);
  };

  const resetNewEventForm = () => {
    setNewVenueName('');
    setNewCity('');
    setNewState('');
    setNewSurveyTypes([]);
    setNewOverlayType('');
  };

  const toggleSurveyType = (type: SurveyTypeSlug) => {
    setNewSurveyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const activeEvents = events.filter((e) => e.status === 'active');
  const completedEvents = events.filter((e) => e.status === 'completed');

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
          />
        }
      >
        {/* Active Events */}
        <View className="mb-6">
          <Text className="text-white text-lg font-semibold mb-3">Active Events</Text>
          {activeEvents.length > 0 ? (
            activeEvents.map((event) => (
              <EventCard
                key={event.id}
                id={event.id}
                venueName={event.venueName}
                city={event.city}
                state={event.state}
                date={event.startedAt}
                surveyCount={MOCK_SURVEY_COUNTS[event.id] || 0}
                pledgeCount={MOCK_PLEDGE_COUNTS[event.id] || 0}
                status={event.status}
                onPress={() => handleEventPress(event)}
              />
            ))
          ) : (
            <View className="bg-zinc-900 rounded-2xl p-6 items-center">
              <Text className="text-zinc-500">No active events</Text>
              <Text className="text-zinc-600 text-sm mt-1">
                Create a new event to get started
              </Text>
            </View>
          )}
        </View>

        {/* Completed Events */}
        {completedEvents.length > 0 ? (
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-3">Completed Events</Text>
            {completedEvents.map((event) => (
              <EventCard
                key={event.id}
                id={event.id}
                venueName={event.venueName}
                city={event.city}
                state={event.state}
                date={event.startedAt}
                surveyCount={MOCK_SURVEY_COUNTS[event.id] || 0}
                pledgeCount={MOCK_PLEDGE_COUNTS[event.id] || 0}
                status={event.status}
                onPress={() => handleEventPress(event)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* New Event Button */}
      <View className="p-4 border-t border-zinc-800">
        <Pressable
          onPress={() => setShowNewEventModal(true)}
          className="flex-row items-center justify-center bg-blue-600 py-4 rounded-xl active:bg-blue-700"
        >
          <Plus size={20} color="#fff" />
          <Text className="text-white font-semibold ml-2">New Event</Text>
        </Pressable>
      </View>

      {/* Event Detail Modal */}
      <Modal
        visible={selectedEvent !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-zinc-900 rounded-t-3xl max-h-[80%]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
              <Text className="text-xl font-bold text-white">Event Details</Text>
              <Pressable onPress={() => setSelectedEvent(null)} className="p-2">
                <X size={24} color="#a1a1aa" />
              </Pressable>
            </View>

            {selectedEvent ? (
              <ScrollView className="px-6 py-4">
                <Text className="text-white text-2xl font-bold mb-2">
                  {selectedEvent.venueName}
                </Text>
                <View className="flex-row items-center mb-4">
                  <MapPin size={16} color="#71717a" />
                  <Text className="text-zinc-400 ml-1">
                    {selectedEvent.city}, {selectedEvent.state}
                  </Text>
                </View>

                <View className="bg-zinc-800 rounded-xl p-4 mb-4">
                  <Text className="text-zinc-400 text-sm mb-2">Survey Types</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {selectedEvent.surveyTypes.map((type) => (
                      <View key={type} className="bg-zinc-700 px-3 py-1 rounded-full">
                        <Text className="text-white text-sm capitalize">{type}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View className="flex-row gap-4 mb-4">
                  <View className="flex-1 bg-zinc-800 rounded-xl p-4">
                    <Text className="text-zinc-400 text-sm">Surveys</Text>
                    <Text className="text-white text-2xl font-bold">
                      {MOCK_SURVEY_COUNTS[selectedEvent.id] || 0}
                    </Text>
                  </View>
                  <View className="flex-1 bg-zinc-800 rounded-xl p-4">
                    <Text className="text-zinc-400 text-sm">Pledges</Text>
                    <Text className="text-white text-2xl font-bold">
                      {MOCK_PLEDGE_COUNTS[selectedEvent.id] || 0}
                    </Text>
                  </View>
                </View>

                <View className="bg-zinc-800 rounded-xl p-4 mb-6">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-zinc-400 text-sm">Started</Text>
                    <Text className="text-white text-sm">
                      {new Date(selectedEvent.startedAt).toLocaleString()}
                    </Text>
                  </View>
                  {selectedEvent.endedAt ? (
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-400 text-sm">Ended</Text>
                      <Text className="text-white text-sm">
                        {new Date(selectedEvent.endedAt).toLocaleString()}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {selectedEvent.status === 'active' ? (
                  <Pressable
                    onPress={() => handleEndEvent(selectedEvent.id)}
                    className="bg-red-600 py-4 rounded-xl items-center mb-6 active:bg-red-700"
                  >
                    <Text className="text-white font-semibold">End Event</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* New Event Modal */}
      <Modal
        visible={showNewEventModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewEventModal(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-zinc-900 rounded-t-3xl max-h-[90%]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
              <Text className="text-xl font-bold text-white">New Event</Text>
              <Pressable
                onPress={() => {
                  resetNewEventForm();
                  setShowNewEventModal(false);
                }}
                className="p-2"
              >
                <X size={24} color="#a1a1aa" />
              </Pressable>
            </View>

            <ScrollView className="px-6 py-4">
              {/* Venue Name */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Venue Name *</Text>
                <TextInput
                  value={newVenueName}
                  onChangeText={setNewVenueName}
                  placeholder="e.g., Central High School"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white"
                />
              </View>

              {/* City */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">City *</Text>
                <TextInput
                  value={newCity}
                  onChangeText={setNewCity}
                  placeholder="e.g., Austin"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white"
                />
              </View>

              {/* State */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">State *</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0 }}
                >
                  <View className="flex-row gap-2">
                    {US_STATES.slice(0, 15).map((state) => (
                      <Pressable
                        key={state.code}
                        onPress={() => setNewState(state.code)}
                        className={cn(
                          'px-4 py-2 rounded-lg',
                          newState === state.code ? 'bg-blue-600' : 'bg-zinc-800'
                        )}
                      >
                        <Text
                          className={cn(
                            'text-sm',
                            newState === state.code ? 'text-white' : 'text-zinc-400'
                          )}
                        >
                          {state.code}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Survey Types */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Survey Types *</Text>
                <View className="flex-row flex-wrap gap-2">
                  {SURVEY_TYPES.map((type) => (
                    <Pressable
                      key={type.slug}
                      onPress={() => toggleSurveyType(type.slug)}
                      className={cn(
                        'px-4 py-2 rounded-lg flex-row items-center',
                        newSurveyTypes.includes(type.slug)
                          ? 'bg-blue-600'
                          : 'bg-zinc-800'
                      )}
                    >
                      {newSurveyTypes.includes(type.slug) ? (
                        <Check size={14} color="#fff" />
                      ) : null}
                      <Text
                        className={cn(
                          'text-sm',
                          newSurveyTypes.includes(type.slug) ? 'text-white ml-1' : 'text-zinc-400'
                        )}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Overlay Type */}
              <View className="mb-6">
                <Text className="text-zinc-400 text-sm mb-2">Photo Overlay Type *</Text>
                <View className="flex-row flex-wrap gap-2">
                  {SURVEY_TYPES.map((type) => (
                    <Pressable
                      key={type.slug}
                      onPress={() => setNewOverlayType(type.slug)}
                      className={cn(
                        'px-4 py-2 rounded-lg',
                        newOverlayType === type.slug ? 'bg-purple-600' : 'bg-zinc-800'
                      )}
                    >
                      <Text
                        className={cn(
                          'text-sm',
                          newOverlayType === type.slug ? 'text-white' : 'text-zinc-400'
                        )}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Create Button */}
              <Pressable
                onPress={handleCreateEvent}
                className="bg-blue-600 py-4 rounded-xl items-center mb-8 active:bg-blue-700"
              >
                <Text className="text-white font-semibold">Create Event</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
