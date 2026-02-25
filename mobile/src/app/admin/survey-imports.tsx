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
import { FileText, Upload, X, ChevronRight, Trash2 } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDeviceStore } from '@/lib/state/device-store';
import { api } from '@/lib/api/api';
import { cn } from '@/lib/cn';

// ── Types ────────────────────────────────────────────────────────────────────

interface ExternalSurveyImport {
  id: string;
  eventId: string;
  surveyPhase: 'pre' | 'post';
  fileName: string;
  rowCount: number;
  headers: string; // JSON string array
  importedAt: string;
  event?: { id: string; venueName: string; eventDate: string };
}

interface ExternalSurveyImportDetail extends ExternalSurveyImport {
  rows: Array<{ id: string; rowIndex: number; data: string }>; // data is JSON string
}

interface Event {
  id: string;
  venueName: string;
  eventDate: string;
  status: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function PhaseBadge({ phase }: { phase: 'pre' | 'post' }) {
  return (
    <View
      className={cn(
        'px-2 py-0.5 rounded-full',
        phase === 'pre' ? 'bg-blue-500/20' : 'bg-green-500/20'
      )}
    >
      <Text
        className={cn(
          'text-xs font-bold tracking-wide',
          phase === 'pre' ? 'text-blue-400' : 'text-green-400'
        )}
      >
        {phase === 'pre' ? 'PRE' : 'POST'}
      </Text>
    </View>
  );
}

// ── Import Detail Modal ───────────────────────────────────────────────────────

function ImportDetailModal({
  importId,
  onClose,
  onDelete,
}: {
  importId: string | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['external-survey-detail', importId],
    queryFn: () => api.get<ExternalSurveyImportDetail>(`/api/external-surveys/${importId}`),
    enabled: !!importId,
  });

  const headers: string[] = (() => {
    try {
      return JSON.parse(detail?.headers ?? '[]');
    } catch {
      return [];
    }
  })();

  const previewRows = detail?.rows?.slice(0, 5) ?? [];

  const handleDelete = () => {
    if (!importId) return;
    Alert.alert(
      'Delete Import',
      'Are you sure you want to delete this import? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(importId);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={!!importId}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80 justify-end">
        <View className="bg-zinc-900 rounded-t-3xl max-h-[90%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
            <Text className="text-xl font-bold text-white">Import Details</Text>
            <Pressable onPress={onClose} className="p-2">
              <X size={24} color="#a1a1aa" />
            </Pressable>
          </View>

          {isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : detail ? (
            <ScrollView className="px-6 py-4">
              {/* Meta */}
              <View className="flex-row items-center gap-2 mb-2">
                <PhaseBadge phase={detail.surveyPhase} />
                <Text className="text-zinc-400 text-sm">
                  {detail.event?.venueName ?? 'Unknown Event'}
                </Text>
              </View>
              <Text className="text-white text-2xl font-bold mb-1">{detail.fileName}</Text>
              <Text className="text-zinc-500 text-sm mb-1">
                {detail.event ? formatDate(detail.event.eventDate) : null}
              </Text>
              <Text className="text-zinc-500 text-sm mb-4">
                {detail.rowCount} responses · Imported {formatDate(detail.importedAt)}
              </Text>

              {/* Column Headers */}
              {headers.length > 0 ? (
                <View className="mb-4">
                  <Text className="text-zinc-400 text-sm font-semibold mb-2">Columns</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                    <View className="flex-row gap-2">
                      {headers.map((h, i) => (
                        <View key={i} className="bg-zinc-800 px-3 py-1.5 rounded-lg">
                          <Text className="text-zinc-300 text-xs">{h}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ) : null}

              {/* Preview Rows */}
              {previewRows.length > 0 ? (
                <View className="mb-6">
                  <Text className="text-zinc-400 text-sm font-semibold mb-2">
                    First {previewRows.length} Rows (Preview)
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator style={{ flexGrow: 0 }}>
                    <View>
                      {/* Header row */}
                      <View className="flex-row border-b border-zinc-700 pb-1 mb-1">
                        {headers.slice(0, 6).map((h, i) => (
                          <View key={i} style={{ width: 120 }} className="pr-2">
                            <Text className="text-zinc-500 text-xs font-semibold" numberOfLines={1}>
                              {h}
                            </Text>
                          </View>
                        ))}
                      </View>
                      {/* Data rows */}
                      {previewRows.map((row) => {
                        let rowData: Record<string, string> = {};
                        try {
                          rowData = JSON.parse(row.data);
                        } catch {
                          // ignore
                        }
                        return (
                          <View key={row.id} className="flex-row py-1 border-b border-zinc-800/50">
                            {headers.slice(0, 6).map((h, i) => (
                              <View key={i} style={{ width: 120 }} className="pr-2">
                                <Text className="text-zinc-300 text-xs" numberOfLines={2}>
                                  {rowData[h] ?? '—'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              ) : null}

              {/* Delete */}
              <Pressable
                onPress={handleDelete}
                className="flex-row items-center justify-center bg-red-600/20 border border-red-600/40 py-4 rounded-xl mb-8 active:bg-red-600/30"
              >
                <Trash2 size={18} color="#ef4444" />
                <Text className="text-red-500 font-semibold ml-2">Delete Import</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <View className="items-center py-12">
              <Text className="text-zinc-400">Could not load import details.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Import Card ───────────────────────────────────────────────────────────────

function ImportCard({
  item,
  onPress,
  onDelete,
}: {
  item: ExternalSurveyImport;
  onPress: () => void;
  onDelete: () => void;
}) {
  const handleLongPress = () => {
    Alert.alert(
      'Delete Import',
      `Delete "${item.fileName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      className="bg-zinc-900 rounded-2xl p-4 mb-3 active:bg-zinc-800"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-2 mb-1">
            <PhaseBadge phase={item.surveyPhase} />
            <Text className="text-zinc-500 text-xs" numberOfLines={1}>
              {item.event ? formatDate(item.event.eventDate) : null}
            </Text>
          </View>
          <Text className="text-white font-semibold text-base mb-0.5" numberOfLines={1}>
            {item.fileName}
          </Text>
          <Text className="text-zinc-500 text-sm" numberOfLines={1}>
            {item.event?.venueName ?? 'Unknown Event'}
          </Text>
          <Text className="text-zinc-600 text-xs mt-1">
            {item.rowCount} responses · {formatDate(item.importedAt)}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <FileText size={16} color="#52525b" />
          <ChevronRight size={16} color="#52525b" />
        </View>
      </View>
    </Pressable>
  );
}

// ── Import Form Modal ─────────────────────────────────────────────────────────

function ImportFormModal({
  visible,
  onClose,
  events,
  teamId,
}: {
  visible: boolean;
  onClose: () => void;
  events: Event[];
  teamId: string | null;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [surveyPhase, setSurveyPhase] = useState<'pre' | 'post'>('pre');
  const [fileName, setFileName] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [showEventPicker, setShowEventPicker] = useState<boolean>(false);

  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (body: {
      eventId: string;
      surveyPhase: 'pre' | 'post';
      fileName: string;
      csvText: string;
    }) => api.post<ExternalSurveyImport>('/api/external-surveys/import', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-surveys'] });
      handleClose();
      Alert.alert('Success', 'Survey data imported successfully.');
    },
    onError: (error: Error) => {
      Alert.alert('Import Failed', error.message || 'Failed to import survey data.');
    },
  });

  const handleClose = () => {
    setSelectedEventId('');
    setSurveyPhase('pre');
    setFileName('');
    setCsvText('');
    setShowEventPicker(false);
    onClose();
  };

  const handleImport = () => {
    if (!selectedEventId) {
      Alert.alert('Missing Event', 'Please select an event.');
      return;
    }
    if (!fileName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for this import.');
      return;
    }
    if (!csvText.trim()) {
      Alert.alert('Missing CSV', 'Please paste CSV data.');
      return;
    }
    importMutation.mutate({
      eventId: selectedEventId,
      surveyPhase,
      fileName: fileName.trim(),
      csvText: csvText.trim(),
    });
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/80 justify-end">
        <View className="bg-zinc-900 rounded-t-3xl max-h-[95%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
            <Text className="text-xl font-bold text-white">Import Survey Data</Text>
            <Pressable onPress={handleClose} className="p-2">
              <X size={24} color="#a1a1aa" />
            </Pressable>
          </View>

          <ScrollView className="px-6 py-4" keyboardShouldPersistTaps="handled">
            {/* Event Picker */}
            <View className="mb-4">
              <Text className="text-zinc-400 text-sm mb-2">Event *</Text>
              <Pressable
                onPress={() => setShowEventPicker(!showEventPicker)}
                className="bg-zinc-800 rounded-xl px-4 py-3 flex-row items-center justify-between active:bg-zinc-700"
              >
                <Text className={selectedEvent ? 'text-white' : 'text-zinc-500'}>
                  {selectedEvent
                    ? `${selectedEvent.venueName} · ${formatDate(selectedEvent.eventDate)}`
                    : 'Select an event'}
                </Text>
                <ChevronRight
                  size={16}
                  color="#71717a"
                  style={{ transform: [{ rotate: showEventPicker ? '-90deg' : '90deg' }] }}
                />
              </Pressable>
              {showEventPicker ? (
                <View className="bg-zinc-800 rounded-xl mt-1 overflow-hidden border border-zinc-700">
                  <ScrollView style={{ maxHeight: 200 }}>
                    {events.length === 0 ? (
                      <View className="px-4 py-3">
                        <Text className="text-zinc-500 text-sm">No events found</Text>
                      </View>
                    ) : null}
                    {events.map((event) => (
                      <Pressable
                        key={event.id}
                        onPress={() => {
                          setSelectedEventId(event.id);
                          setShowEventPicker(false);
                        }}
                        className={cn(
                          'px-4 py-3 border-b border-zinc-700/50 active:bg-zinc-700',
                          selectedEventId === event.id ? 'bg-blue-600/20' : ''
                        )}
                      >
                        <Text className="text-white text-sm">{event.venueName}</Text>
                        <Text className="text-zinc-500 text-xs mt-0.5">
                          {formatDate(event.eventDate)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            {/* Phase Selector */}
            <View className="mb-4">
              <Text className="text-zinc-400 text-sm mb-2">Survey Phase *</Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setSurveyPhase('pre')}
                  className={cn(
                    'flex-1 py-3 rounded-xl items-center border',
                    surveyPhase === 'pre'
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-zinc-800 border-zinc-700'
                  )}
                >
                  <Text
                    className={cn(
                      'font-semibold',
                      surveyPhase === 'pre' ? 'text-blue-400' : 'text-zinc-400'
                    )}
                  >
                    Pre-Event
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSurveyPhase('post')}
                  className={cn(
                    'flex-1 py-3 rounded-xl items-center border',
                    surveyPhase === 'post'
                      ? 'bg-green-600/20 border-green-500'
                      : 'bg-zinc-800 border-zinc-700'
                  )}
                >
                  <Text
                    className={cn(
                      'font-semibold',
                      surveyPhase === 'post' ? 'text-green-400' : 'text-zinc-400'
                    )}
                  >
                    Post-Event
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Import Name */}
            <View className="mb-4">
              <Text className="text-zinc-400 text-sm mb-2">Import Name *</Text>
              <TextInput
                value={fileName}
                onChangeText={setFileName}
                placeholder="e.g., School Visit Pre-Survey"
                placeholderTextColor="#52525b"
                className="bg-zinc-800 rounded-xl px-4 py-3 text-white"
              />
            </View>

            {/* CSV Input */}
            <View className="mb-4">
              <Text className="text-zinc-400 text-sm mb-2">Paste CSV Data *</Text>
              <TextInput
                value={csvText}
                onChangeText={setCsvText}
                placeholder="Paste CSV contents here..."
                placeholderTextColor="#52525b"
                multiline
                textAlignVertical="top"
                className="bg-zinc-800 rounded-xl px-4 py-3 text-white"
                style={{ minHeight: 150 }}
              />
              <Text className="text-zinc-600 text-xs mt-2 leading-4">
                To export from Google Forms: open the linked Google Sheet, then go to File {'>'} Download {'>'} Comma Separated Values (.csv), then copy and paste the full contents here.
              </Text>
            </View>

            {/* Import Button */}
            <Pressable
              onPress={handleImport}
              disabled={importMutation.isPending}
              className="flex-row items-center justify-center bg-blue-600 py-4 rounded-xl mb-8 active:bg-blue-700"
            >
              {importMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Upload size={18} color="#fff" />
                  <Text className="text-white font-semibold ml-2">Import</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SurveyImportsScreen() {
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);

  const teamId = useDeviceStore((s) => s.teamId);
  const queryClient = useQueryClient();

  // Fetch all imports
  const {
    data: imports,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['external-surveys', teamId],
    queryFn: () => api.get<ExternalSurveyImport[]>('/api/external-surveys'),
    enabled: !!teamId,
  });

  // Fetch events for the picker
  const { data: events } = useQuery({
    queryKey: ['admin-events', teamId],
    queryFn: () => api.get<Event[]>(`/api/events?teamId=${teamId}`),
    enabled: !!teamId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/external-surveys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-surveys'] });
      queryClient.invalidateQueries({ queryKey: ['external-survey-detail'] });
    },
    onError: (error: Error) => {
      Alert.alert('Delete Failed', error.message || 'Failed to delete import.');
    },
  });

  // Group imports by event
  const grouped = (imports ?? []).reduce<Record<string, ExternalSurveyImport[]>>((acc, item) => {
    const key = item.eventId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped);

  if (!teamId) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-8">
        <FileText size={48} color="#3f3f46" />
        <Text className="text-zinc-400 text-lg font-semibold mt-4 text-center">
          No Team Configured
        </Text>
        <Text className="text-zinc-600 text-sm mt-2 text-center">
          Set up your device with a team code first to manage survey imports.
        </Text>
      </View>
    );
  }

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
            <Text className="text-zinc-400 mt-4">Loading imports...</Text>
          </View>
        ) : groupKeys.length === 0 ? (
          <View className="items-center py-16">
            <View className="bg-zinc-900 rounded-3xl p-8 items-center">
              <FileText size={40} color="#3f3f46" />
              <Text className="text-zinc-400 font-semibold text-base mt-4 text-center">
                No imports yet
              </Text>
              <Text className="text-zinc-600 text-sm mt-1 text-center">
                Tap the button below to import survey data from Google Sheets.
              </Text>
            </View>
          </View>
        ) : (
          groupKeys.map((eventId) => {
            const groupItems = grouped[eventId];
            const firstItem = groupItems[0];
            const eventLabel = firstItem.event
              ? `${firstItem.event.venueName} · ${formatDate(firstItem.event.eventDate)}`
              : eventId;

            return (
              <View key={eventId} className="mb-6">
                <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2 px-1">
                  {eventLabel}
                </Text>
                {groupItems.map((item) => (
                  <ImportCard
                    key={item.id}
                    item={item}
                    onPress={() => setSelectedImportId(item.id)}
                    onDelete={() => deleteMutation.mutate(item.id)}
                  />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Import Button */}
      <View className="p-4 border-t border-zinc-800">
        <Pressable
          onPress={() => setShowImportModal(true)}
          className="flex-row items-center justify-center bg-blue-600 py-4 rounded-xl active:bg-blue-700"
        >
          <Upload size={20} color="#fff" />
          <Text className="text-white font-semibold ml-2">Import Survey Data</Text>
        </Pressable>
      </View>

      {/* Import Form Modal */}
      <ImportFormModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        events={events ?? []}
        teamId={teamId}
      />

      {/* Import Detail Modal */}
      <ImportDetailModal
        importId={selectedImportId}
        onClose={() => setSelectedImportId(null)}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </View>
  );
}
