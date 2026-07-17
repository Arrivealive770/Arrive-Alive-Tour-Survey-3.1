import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Plus, X, MapPin, Check, Calendar, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EventCard } from '@/components/admin/EventCard';
import { useDeviceStore } from '@/lib/state/device-store';
import { api } from '@/lib/api/api';
import {
  SURVEY_TYPES,
  US_STATES,
  type SurveyTypeSlug,
  type Event,
  type CreateEventRequest,
  type Overlay,
  type PurgePhotosResponse,
} from '@/lib/api/types';
import { cn } from '@/lib/cn';

interface EventWithCounts extends Event {
  _count?: {
    surveyResponses: number;
    pledges: number;
    photos: number;
  };
}

export default function EventsScreen() {
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventWithCounts | null>(null);

  // New event form state
  const [newVenueName, setNewVenueName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newSurveyTypes, setNewSurveyTypes] = useState<SurveyTypeSlug[]>([]);
  const [newOverlayType, setNewOverlayType] = useState<SurveyTypeSlug | ''>('');

  const teamId = useDeviceStore((s) => s.teamId);
  const queryClient = useQueryClient();

  // Fetch events from API
  const { data: events, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-events', teamId],
    queryFn: () => api.get<EventWithCounts[]>(`/api/events?teamId=${teamId}`),
    enabled: !!teamId,
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventRequest) => {
      return api.post<Event>('/api/events', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      resetNewEventForm();
      setShowNewEventModal(false);
      Alert.alert('Success', 'Event created! Field workers can now select this event.');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to create event');
    },
  });

  // End event mutation
  const endEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return api.put<Event>(`/api/events/${eventId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      setSelectedEvent(null);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to end event');
    },
  });

  // Fetch available overlays for per-event assignment
  const { data: overlays } = useQuery({
    queryKey: ['overlays'],
    queryFn: () => api.get<Overlay[]>('/api/overlays'),
  });

  // Assign an overlay to the selected event
  const assignOverlayMutation = useMutation({
    mutationFn: async ({ eventId, overlayId }: { eventId: string; overlayId: string }) => {
      return api.put<Event>(`/api/events/${eventId}`, { overlayId });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      setSelectedEvent((prev) =>
        prev && prev.id === updated.id
          ? { ...prev, overlayId: updated.overlayId, overlay: updated.overlay }
          : prev
      );
      Alert.alert('Overlay Assigned', 'This overlay will be applied to pledge photos for this event.');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to assign overlay');
    },
  });

  // Post-event photo purge (propagates deletion to phone + both tablets)
  const purgePhotosMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return api.delete<PurgePhotosResponse>(`/api/photos/purge/${eventId}`);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      Alert.alert(
        'Photos Deleted',
        `${result?.purgedCount ?? 0} photo${(result?.purgedCount ?? 0) === 1 ? '' : 's'} deleted. Devices will remove their local copies shortly.`
      );
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to delete photos');
    },
  });

  const handlePurgePhotos = (eventId: string) => {
    Alert.alert(
      'Delete All Photos',
      'This permanently deletes ALL photos for this event from the cloud, and removes them from the phone and both tablets. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => purgePhotosMutation.mutate(eventId),
        },
      ]
    );
  };

  const handleEventPress = (event: EventWithCounts) => {
    setSelectedEvent(event);
  };

  const handleEndEvent = (eventId: string) => {
    Alert.alert(
      'End Event',
      'Are you sure you want to end this event? Field workers will no longer be able to select it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Event',
          style: 'destructive',
          onPress: () => endEventMutation.mutate(eventId),
        },
      ]
    );
  };

  const handleCreateEvent = () => {
    if (!newVenueName || !newCity || !newState || newSurveyTypes.length === 0 || !newOverlayType) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (!teamId) {
      Alert.alert('Error', 'No team selected. Please set up the device first.');
      return;
    }

    const eventDate = newEventDate ? new Date(newEventDate).toISOString() : new Date().toISOString();

    createEventMutation.mutate({
      teamId,
      venueName: newVenueName,
      venueCity: newCity,
      venueState: newState,
      eventDate,
      surveyTypes: newSurveyTypes,
      overlayType: newOverlayType,
    });
  };

  const resetNewEventForm = () => {
    setNewVenueName('');
    setNewCity('');
    setNewState('');
    setNewEventDate('');
    setNewSurveyTypes([]);
    setNewOverlayType('');
  };

  const toggleSurveyType = (type: SurveyTypeSlug) => {
    setNewSurveyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const activeEvents = events?.filter((e) => e.status === 'active') || [];
  const completedEvents = events?.filter((e) => e.status === 'completed') || [];

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
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
        ) : (
          <>
            {/* Active Events */}
            <View className="mb-6">
              <Text className="text-white text-lg font-semibold mb-3">Active Events</Text>
              {activeEvents.length > 0 ? (
                activeEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    id={event.id}
                    venueName={event.venueName}
                    city={event.venueCity}
                    state={event.venueState}
                    date={event.eventDate}
                    surveyCount={event._count?.surveyResponses || 0}
                    pledgeCount={event._count?.pledges || 0}
                    status={event.status}
                    onPress={() => handleEventPress(event)}
                  />
                ))
              ) : (
                <View className="bg-zinc-900 rounded-2xl p-6 items-center">
                  <Text className="text-zinc-500">No active events</Text>
                  <Text className="text-zinc-600 text-sm mt-1">
                    Create a new event for your field team
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
                    city={event.venueCity}
                    state={event.venueState}
                    date={event.eventDate}
                    surveyCount={event._count?.surveyResponses || 0}
                    pledgeCount={event._count?.pledges || 0}
                    status={event.status}
                    onPress={() => handleEventPress(event)}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
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
                <View className="flex-row items-center mb-2">
                  <MapPin size={16} color="#71717a" />
                  <Text className="text-zinc-400 ml-1">
                    {selectedEvent.venueCity}, {selectedEvent.venueState}
                  </Text>
                </View>
                <View className="flex-row items-center mb-4">
                  <Calendar size={16} color="#71717a" />
                  <Text className="text-zinc-400 ml-1">
                    {new Date(selectedEvent.eventDate).toLocaleDateString()}
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
                      {selectedEvent._count?.surveyResponses || 0}
                    </Text>
                  </View>
                  <View className="flex-1 bg-zinc-800 rounded-xl p-4">
                    <Text className="text-zinc-400 text-sm">Pledges</Text>
                    <Text className="text-white text-2xl font-bold">
                      {selectedEvent._count?.pledges || 0}
                    </Text>
                  </View>
                </View>

                {/* Per-event Photo Overlay assignment */}
                <View className="bg-zinc-800 rounded-xl p-4 mb-4">
                  <View className="flex-row items-center mb-2">
                    <ImageIcon size={16} color="#a78bfa" />
                    <Text className="text-zinc-300 text-sm font-semibold ml-2">
                      Pledge Photo Overlay
                    </Text>
                  </View>
                  <Text className="text-zinc-500 text-xs mb-3">
                    {selectedEvent.overlay?.name
                      ? `Current: ${selectedEvent.overlay.name}`
                      : 'No overlay assigned yet. Pick one to apply to pledge photos.'}
                  </Text>
                  {overlays && overlays.length > 0 ? (
                    <View className="flex-row flex-wrap gap-2">
                      {overlays.map((overlay) => {
                        const isAssigned = selectedEvent.overlayId === overlay.id;
                        return (
                          <Pressable
                            key={overlay.id}
                            onPress={() =>
                              assignOverlayMutation.mutate({
                                eventId: selectedEvent.id,
                                overlayId: overlay.id,
                              })
                            }
                            disabled={assignOverlayMutation.isPending}
                            className={cn(
                              'flex-row items-center px-3 py-2 rounded-lg',
                              isAssigned ? 'bg-purple-600' : 'bg-zinc-700'
                            )}
                          >
                            {isAssigned ? (
                              <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                            ) : null}
                            <Text
                              className={cn(
                                'text-sm',
                                isAssigned ? 'text-white' : 'text-zinc-300'
                              )}
                            >
                              {overlay.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text className="text-zinc-600 text-xs">
                      No overlays available. Upload one first.
                    </Text>
                  )}
                </View>

                {selectedEvent.status === 'active' ? (
                  <Pressable
                    onPress={() => handleEndEvent(selectedEvent.id)}
                    disabled={endEventMutation.isPending}
                    className="bg-red-600 py-4 rounded-xl items-center mb-4 active:bg-red-700"
                  >
                    {endEventMutation.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-semibold">End Event</Text>
                    )}
                  </Pressable>
                ) : (
                  <View className="bg-zinc-800 py-4 rounded-xl items-center mb-4">
                    <Text className="text-zinc-500 font-semibold">Event Completed</Text>
                  </View>
                )}

                {/* Post-event: delete all photos everywhere */}
                <Pressable
                  onPress={() => handlePurgePhotos(selectedEvent.id)}
                  disabled={purgePhotosMutation.isPending}
                  className="flex-row items-center justify-center border border-red-600/60 py-4 rounded-xl mb-6 active:bg-red-950"
                >
                  {purgePhotosMutation.isPending ? (
                    <ActivityIndicator color="#f87171" />
                  ) : (
                    <>
                      <Trash2 size={18} color="#f87171" style={{ marginRight: 8 }} />
                      <Text className="text-red-400 font-semibold">
                        Delete all photos (post-event)
                      </Text>
                    </>
                  )}
                </Pressable>
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
                    {US_STATES.map((state) => (
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

              {/* Event Date */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Event Date (optional)</Text>
                <TextInput
                  value={newEventDate}
                  onChangeText={setNewEventDate}
                  placeholder="YYYY-MM-DD (leave blank for today)"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white"
                />
              </View>

              {/* Survey Types */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Survey Types *</Text>
                <Text className="text-zinc-600 text-xs mb-3">
                  Select which surveys field workers will collect at this event
                </Text>
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
                disabled={createEventMutation.isPending}
                className="bg-blue-600 py-4 rounded-xl items-center mb-8 active:bg-blue-700"
              >
                {createEventMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Create Event</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
