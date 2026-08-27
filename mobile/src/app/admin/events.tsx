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
  Platform,
} from 'react-native';
import {
  Plus,
  X,
  MapPin,
  Check,
  Calendar,
  Image as ImageIcon,
  Trash2,
  Upload,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EventCard } from '@/components/admin/EventCard';
import { useDeviceStore } from '@/lib/state/device-store';
import { api } from '@/lib/api/api';
import { useSurveyTypes } from '@/lib/survey-questions';
import {
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
  // Shown inline under the upload button. Alert.alert does nothing on web, so
  // upload failures were invisible there.
  const [uploadMessage, setUploadMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

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

  // The surveys built in the admin portal. These drive event creation — a new
  // survey shows up here without an app update.
  const {
    data: builtSurveys,
    isLoading: surveysLoading,
    isError: surveysFailed,
    refetch: refetchSurveys,
  } = useSurveyTypes();

  // Only surveys that are switched on can be collected at an event.
  const availableSurveys = (builtSurveys ?? []).filter((survey) => survey.isActive);

  const surveyNameFor = (slug: string) =>
    builtSurveys?.find((survey) => survey.slug === slug)?.name ?? slug;

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

  // Upload a new overlay image (JPG frame or transparent PNG) from this device.
  const uploadOverlayMutation = useMutation({
    mutationFn: async ({ uri, name, fileName }: { uri: string; name: string; fileName: string }) => {
      const contentType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const formData = new FormData();

      if (Platform.OS === 'web') {
        // On web the { uri, name, type } descriptor is serialised as text and
        // the image never reaches the server. Read the picked file into a real
        // Blob first.
        const fileResponse = await fetch(uri);
        const blob = await fileResponse.blob();
        formData.append('file', new File([blob], fileName, { type: blob.type || contentType }));
      } else {
        // React Native's FormData takes a { uri, name, type } descriptor.
        formData.append('file', {
          uri,
          name: fileName,
          type: contentType,
        } as unknown as Blob);
      }
      formData.append('name', name);

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/overlays`, {
        method: 'POST',
        body: formData,
      });

      // Read as text first — a proxy error or crash returns HTML, and parsing
      // that as JSON throws away the real reason for the failure.
      const raw = await response.text();
      let body: { data?: Overlay; error?: { message?: string } } | null = null;
      try {
        body = JSON.parse(raw) as { data?: Overlay; error?: { message?: string } };
      } catch {
        body = null;
      }

      if (!response.ok || !body?.data) {
        const reason =
          body?.error?.message ??
          (raw ? raw.slice(0, 200) : `Server returned ${response.status} with no details`);
        throw new Error(`(${response.status}) ${reason}`);
      }
      return body.data;
    },
    onSuccess: (overlay) => {
      queryClient.invalidateQueries({ queryKey: ['overlays'] });
      setUploadMessage({
        tone: 'success',
        text:
          overlay.mode === 'frame'
            ? `"${overlay.name}" was added as a photo frame — pledge photos sit inside it, like a polaroid. Tap it below to use it for this event.`
            : `"${overlay.name}" was added and will be laid over pledge photos. Tap it below to use it for this event.`,
      });
    },
    onError: (error: Error) => {
      setUploadMessage({
        tone: 'error',
        text: error.message || 'Could not upload that image',
      });
    },
  });

  const handleUploadOverlay = async () => {
    setUploadMessage(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadMessage({
        tone: 'error',
        text: 'Photo access is off for this app. Turn it on in Settings, then try again.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const pickedName = asset.fileName ?? `overlay-${Date.now()}.jpg`;
    const baseName = pickedName.replace(/\.[^.]+$/, '');
    // Trust the actual file on disk over the library's filename — iPhone
    // photos often report ".HEIC" for a file the picker already converted.
    const uriExtension = asset.uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';

    let uri = asset.uri;
    let fileName = `${baseName}.${uriExtension || 'jpg'}`;

    // PNGs go up untouched so transparency survives. Anything else (HEIC in
    // particular, which the server can't read) is re-encoded as a JPEG.
    if (uriExtension !== 'png') {
      try {
        const converted = await ImageManipulator.manipulateAsync(asset.uri, [], {
          compress: 0.95,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        uri = converted.uri;
        fileName = `${baseName}.jpg`;
      } catch (conversionError) {
        setUploadMessage({
          tone: 'error',
          text: `Could not read that image (${
            conversionError instanceof Error ? conversionError.message : 'unknown error'
          }). Try exporting it as a PNG or JPG.`,
        });
        return;
      }
    }

    // Name it after the current event so it's easy to find later.
    const name = selectedEvent ? `${selectedEvent.venueName} Frame` : baseName;

    uploadOverlayMutation.mutate({ uri, name, fileName });
  };

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
    setNewSurveyTypes((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      // The overlay type has to be one of the surveys still selected.
      setNewOverlayType((current) => (current && next.includes(current) ? current : next[0] ?? ''));
      return next;
    });
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
                        <Text className="text-white text-sm">{surveyNameFor(type)}</Text>
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
                      : 'No overlay assigned — photos use the standard Arrive Alive frame. Pick one to use your own artwork.'}
                  </Text>

                  {/* Live preview of how a pledge photo will come out */}
                  {selectedEvent.overlayId ? (
                    <View className="items-center mb-3">
                      <Image
                        source={{
                          uri: `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/overlays/${selectedEvent.overlayId}/preview`,
                        }}
                        style={{
                          width: 150,
                          height: 190,
                          borderRadius: 8,
                          backgroundColor: '#18181b',
                        }}
                        contentFit="contain"
                      />
                      <Text className="text-zinc-600 text-xs mt-1">
                        Sample of how photos will look
                      </Text>
                    </View>
                  ) : null}

                  {/* Upload a frame straight from this device */}
                  <Pressable
                    onPress={handleUploadOverlay}
                    disabled={uploadOverlayMutation.isPending}
                    className="flex-row items-center justify-center bg-zinc-700 py-3 rounded-lg mb-3 active:bg-zinc-600"
                  >
                    {uploadOverlayMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Upload size={16} color="#a78bfa" />
                        <Text className="text-zinc-200 text-sm font-semibold ml-2">
                          Upload a JPG frame
                        </Text>
                      </>
                    )}
                  </Pressable>
                  {uploadMessage ? (
                    <View
                      className={cn(
                        'rounded-lg p-3 mb-3',
                        uploadMessage.tone === 'error' ? 'bg-red-950' : 'bg-emerald-950'
                      )}
                    >
                      <Text
                        className={cn(
                          'text-xs',
                          uploadMessage.tone === 'error' ? 'text-red-200' : 'text-emerald-200'
                        )}
                      >
                        {uploadMessage.text}
                      </Text>
                      <Pressable onPress={() => setUploadMessage(null)} className="mt-2">
                        <Text className="text-zinc-400 text-xs font-semibold">Dismiss</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <Text className="text-zinc-600 text-xs mb-3">
                    A JPG works like a polaroid — the photo goes inside the window in your artwork.
                    A see-through PNG is laid over the photo instead.
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

                {surveysLoading ? (
                  <View className="flex-row items-center py-2">
                    <ActivityIndicator size="small" color="#71717a" />
                    <Text className="text-zinc-500 text-sm ml-2">Loading your surveys…</Text>
                  </View>
                ) : surveysFailed ? (
                  <View className="bg-red-950 rounded-lg p-3">
                    <Text className="text-red-200 text-xs">
                      Could not load your surveys. Check the connection and try again.
                    </Text>
                    <Pressable onPress={() => refetchSurveys()} className="mt-2">
                      <Text className="text-red-100 text-xs font-semibold">Retry</Text>
                    </Pressable>
                  </View>
                ) : availableSurveys.length === 0 ? (
                  <View className="bg-zinc-800 rounded-lg p-3">
                    <Text className="text-zinc-400 text-xs">
                      No active surveys yet. Build a survey in the admin site first — it will
                      appear here automatically.
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {availableSurveys.map((survey) => (
                      <Pressable
                        key={survey.slug}
                        onPress={() => toggleSurveyType(survey.slug)}
                        className={cn(
                          'px-4 py-2 rounded-lg flex-row items-center',
                          newSurveyTypes.includes(survey.slug)
                            ? 'bg-blue-600'
                            : 'bg-zinc-800'
                        )}
                      >
                        {newSurveyTypes.includes(survey.slug) ? (
                          <Check size={14} color="#fff" />
                        ) : null}
                        <Text
                          className={cn(
                            'text-sm',
                            newSurveyTypes.includes(survey.slug)
                              ? 'text-white ml-1'
                              : 'text-zinc-400'
                          )}
                        >
                          {survey.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Overlay Type */}
              <View className="mb-6">
                <Text className="text-zinc-400 text-sm mb-2">Photo Overlay Type *</Text>
                <Text className="text-zinc-600 text-xs mb-3">
                  Which survey's artwork goes on pledge photos at this event
                </Text>
                {newSurveyTypes.length === 0 ? (
                  <View className="bg-zinc-800 rounded-lg p-3">
                    <Text className="text-zinc-400 text-xs">
                      Pick at least one survey above first.
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {newSurveyTypes.map((slug) => (
                      <Pressable
                        key={slug}
                        onPress={() => setNewOverlayType(slug)}
                        className={cn(
                          'px-4 py-2 rounded-lg',
                          newOverlayType === slug ? 'bg-purple-600' : 'bg-zinc-800'
                        )}
                      >
                        <Text
                          className={cn(
                            'text-sm',
                            newOverlayType === slug ? 'text-white' : 'text-zinc-400'
                          )}
                        >
                          {surveyNameFor(slug)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
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
