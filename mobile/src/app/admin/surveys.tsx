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
import {
  Plus,
  X,
  Check,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  GripVertical,
  BarChart3,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/api';
import { cn } from '@/lib/cn';
import { useRouter } from 'expo-router';

// Types for survey management
interface SurveyQuestion {
  id?: string;
  orderIndex: number;
  questionText: string;
  answerType: string;
  options: string[];
  isRequired: boolean;
}

interface SurveyType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  questions: SurveyQuestion[];
}

interface CreateSurveyTypeRequest {
  slug: string;
  name: string;
  description?: string;
  questions?: Omit<SurveyQuestion, 'id'>[];
}

interface UpdateSurveyTypeRequest {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  questions?: Omit<SurveyQuestion, 'id'>[];
}

export default function SurveysScreen() {
  const router = useRouter();
  const [showNewSurveyModal, setShowNewSurveyModal] = useState(false);
  const [showEditSurveyModal, setShowEditSurveyModal] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyType | null>(null);
  const [expandedSurvey, setExpandedSurvey] = useState<string | null>(null);

  // New survey form state
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newQuestions, setNewQuestions] = useState<Omit<SurveyQuestion, 'id'>[]>([]);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQuestions, setEditQuestions] = useState<Omit<SurveyQuestion, 'id'>[]>([]);

  const queryClient = useQueryClient();

  // Fetch survey types from API
  const { data: surveyTypes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['survey-types'],
    queryFn: () => api.get<SurveyType[]>('/api/surveys/types?includeInactive=true'),
  });

  // Create survey mutation
  const createSurveyMutation = useMutation({
    mutationFn: async (data: CreateSurveyTypeRequest) => {
      return api.post<SurveyType>('/api/surveys/types', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-types'] });
      resetNewSurveyForm();
      setShowNewSurveyModal(false);
      Alert.alert('Success', 'Survey type created successfully!');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to create survey type');
    },
  });

  // Update survey mutation
  const updateSurveyMutation = useMutation({
    mutationFn: async ({ slug, data }: { slug: string; data: UpdateSurveyTypeRequest }) => {
      return api.put<SurveyType>(`/api/surveys/types/${slug}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-types'] });
      setShowEditSurveyModal(false);
      setSelectedSurvey(null);
      Alert.alert('Success', 'Survey type updated successfully!');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to update survey type');
    },
  });

  // Delete survey mutation
  const deleteSurveyMutation = useMutation({
    mutationFn: async ({ slug, hard }: { slug: string; hard: boolean }) => {
      return api.delete<{ deleted: boolean; deactivated?: boolean; slug: string }>(`/api/surveys/types/${slug}${hard ? '?hard=true' : ''}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['survey-types'] });
      Alert.alert('Success', variables.hard ? 'Survey type deleted permanently.' : 'Survey type deactivated.');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to delete survey type');
    },
  });

  const handleCreateSurvey = () => {
    if (!newSlug || !newName) {
      Alert.alert('Missing Information', 'Please enter a slug and name.');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(newSlug)) {
      Alert.alert('Invalid Slug', 'Slug must be lowercase letters, numbers, and hyphens only.');
      return;
    }

    createSurveyMutation.mutate({
      slug: newSlug,
      name: newName,
      description: newDescription || undefined,
      questions: newQuestions.length > 0 ? newQuestions : undefined,
    });
  };

  const handleUpdateSurvey = () => {
    if (!selectedSurvey) return;

    if (!editName) {
      Alert.alert('Missing Information', 'Please enter a name.');
      return;
    }

    updateSurveyMutation.mutate({
      slug: selectedSurvey.slug,
      data: {
        name: editName,
        description: editDescription || null,
        questions: editQuestions.length > 0 ? editQuestions : undefined,
      },
    });
  };

  const handleDeleteSurvey = (survey: SurveyType) => {
    Alert.alert(
      'Delete Survey Type',
      `What would you like to do with "${survey.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          onPress: () => deleteSurveyMutation.mutate({ slug: survey.slug, hard: false }),
        },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Delete',
              'This will permanently delete this survey type and all its questions. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteSurveyMutation.mutate({ slug: survey.slug, hard: true }),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleEditSurvey = (survey: SurveyType) => {
    setSelectedSurvey(survey);
    setEditName(survey.name);
    setEditDescription(survey.description || '');
    setEditQuestions(survey.questions.map((q) => ({
      orderIndex: q.orderIndex,
      questionText: q.questionText,
      answerType: q.answerType,
      options: q.options,
      isRequired: q.isRequired,
    })));
    setShowEditSurveyModal(true);
  };

  const toggleSurveyActive = (survey: SurveyType) => {
    updateSurveyMutation.mutate({
      slug: survey.slug,
      data: { isActive: !survey.isActive },
    });
  };

  const resetNewSurveyForm = () => {
    setNewSlug('');
    setNewName('');
    setNewDescription('');
    setNewQuestions([]);
  };

  const addQuestion = (questions: Omit<SurveyQuestion, 'id'>[], setQuestions: (q: Omit<SurveyQuestion, 'id'>[]) => void) => {
    const newQuestion: Omit<SurveyQuestion, 'id'> = {
      orderIndex: questions.length + 1,
      questionText: '',
      answerType: 'single_choice',
      options: ['', ''],
      isRequired: true,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (
    index: number,
    field: keyof Omit<SurveyQuestion, 'id'>,
    value: string | boolean | string[] | number,
    questions: Omit<SurveyQuestion, 'id'>[],
    setQuestions: (q: Omit<SurveyQuestion, 'id'>[]) => void
  ) => {
    const updated = [...questions];
    (updated[index] as any)[field] = value;
    setQuestions(updated);
  };

  const removeQuestion = (index: number, questions: Omit<SurveyQuestion, 'id'>[], setQuestions: (q: Omit<SurveyQuestion, 'id'>[]) => void) => {
    const updated = questions.filter((_, i) => i !== index);
    // Reorder
    updated.forEach((q, i) => (q.orderIndex = i + 1));
    setQuestions(updated);
  };

  const addOption = (questionIndex: number, questions: Omit<SurveyQuestion, 'id'>[], setQuestions: (q: Omit<SurveyQuestion, 'id'>[]) => void) => {
    const updated = [...questions];
    updated[questionIndex].options.push('');
    setQuestions(updated);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string, questions: Omit<SurveyQuestion, 'id'>[], setQuestions: (q: Omit<SurveyQuestion, 'id'>[]) => void) => {
    const updated = [...questions];
    updated[questionIndex].options[optionIndex] = value;
    setQuestions(updated);
  };

  const removeOption = (questionIndex: number, optionIndex: number, questions: Omit<SurveyQuestion, 'id'>[], setQuestions: (q: Omit<SurveyQuestion, 'id'>[]) => void) => {
    const updated = [...questions];
    if (updated[questionIndex].options.length > 2) {
      updated[questionIndex].options.splice(optionIndex, 1);
      setQuestions(updated);
    }
  };

  const activeSurveys = surveyTypes?.filter((s) => s.isActive) || [];
  const inactiveSurveys = surveyTypes?.filter((s) => !s.isActive) || [];

  const renderQuestionEditor = (
    questions: Omit<SurveyQuestion, 'id'>[],
    setQuestions: (q: Omit<SurveyQuestion, 'id'>[]) => void
  ) => (
    <View className="mb-4">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-zinc-400 text-sm">Questions</Text>
        <Pressable
          onPress={() => addQuestion(questions, setQuestions)}
          className="flex-row items-center bg-zinc-800 px-3 py-1.5 rounded-lg"
        >
          <Plus size={14} color="#3b82f6" />
          <Text className="text-blue-500 text-sm ml-1">Add Question</Text>
        </Pressable>
      </View>

      {questions.map((question, qIndex) => (
        <View key={qIndex} className="bg-zinc-800 rounded-xl p-4 mb-3">
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-row items-center">
              <GripVertical size={16} color="#71717a" />
              <Text className="text-zinc-400 text-sm ml-2">Question {qIndex + 1}</Text>
            </View>
            <Pressable
              onPress={() => removeQuestion(qIndex, questions, setQuestions)}
              className="p-1"
            >
              <Trash2 size={16} color="#ef4444" />
            </Pressable>
          </View>

          <TextInput
            value={question.questionText}
            onChangeText={(v) => updateQuestion(qIndex, 'questionText', v, questions, setQuestions)}
            placeholder="Question text"
            placeholderTextColor="#52525b"
            multiline
            className="bg-zinc-700 rounded-lg px-3 py-2 text-white mb-3"
          />

          <Text className="text-zinc-500 text-xs mb-2">Options (minimum 2)</Text>
          {question.options.map((option, oIndex) => (
            <View key={oIndex} className="flex-row items-center mb-2">
              <TextInput
                value={option}
                onChangeText={(v) => updateOption(qIndex, oIndex, v, questions, setQuestions)}
                placeholder={`Option ${oIndex + 1}`}
                placeholderTextColor="#52525b"
                className="flex-1 bg-zinc-700 rounded-lg px-3 py-2 text-white"
              />
              {question.options.length > 2 ? (
                <Pressable
                  onPress={() => removeOption(qIndex, oIndex, questions, setQuestions)}
                  className="ml-2 p-2"
                >
                  <X size={14} color="#ef4444" />
                </Pressable>
              ) : <View className="w-8" />}
            </View>
          ))}

          <Pressable
            onPress={() => addOption(qIndex, questions, setQuestions)}
            className="flex-row items-center justify-center py-2"
          >
            <Plus size={14} color="#71717a" />
            <Text className="text-zinc-500 text-sm ml-1">Add Option</Text>
          </Pressable>

          <View className="flex-row items-center mt-2">
            <Pressable
              onPress={() => updateQuestion(qIndex, 'isRequired', !question.isRequired, questions, setQuestions)}
              className="flex-row items-center"
            >
              <View className={cn(
                'w-5 h-5 rounded border items-center justify-center mr-2',
                question.isRequired ? 'bg-blue-600 border-blue-600' : 'border-zinc-600'
              )}>
                {question.isRequired ? <Check size={12} color="#fff" /> : null}
              </View>
              <Text className="text-zinc-400 text-sm">Required</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {questions.length === 0 ? (
        <View className="bg-zinc-800/50 rounded-xl p-4 items-center">
          <Text className="text-zinc-500 text-sm">No questions added yet</Text>
        </View>
      ) : null}
    </View>
  );

  const renderSurveyCard = (survey: SurveyType) => {
    const isExpanded = expandedSurvey === survey.id;

    return (
      <View key={survey.id} className="bg-zinc-900 rounded-xl mb-3 overflow-hidden">
        <Pressable
          onPress={() => setExpandedSurvey(isExpanded ? null : survey.id)}
          className="flex-row items-center p-4"
        >
          <View className={cn(
            'w-10 h-10 rounded-xl items-center justify-center mr-3',
            survey.isActive ? 'bg-blue-500/20' : 'bg-zinc-800'
          )}>
            <ClipboardList size={20} color={survey.isActive ? '#3b82f6' : '#71717a'} />
          </View>
          <View className="flex-1">
            <Text className="text-white font-medium">{survey.name}</Text>
            <Text className="text-zinc-500 text-sm">{survey.slug}</Text>
          </View>
          <View className="flex-row items-center">
            <View className={cn(
              'px-2 py-1 rounded-full mr-3',
              survey.isActive ? 'bg-green-500/20' : 'bg-zinc-800'
            )}>
              <Text className={cn(
                'text-xs',
                survey.isActive ? 'text-green-500' : 'text-zinc-500'
              )}>
                {survey.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
            {isExpanded ? (
              <ChevronUp size={20} color="#71717a" />
            ) : (
              <ChevronDown size={20} color="#71717a" />
            )}
          </View>
        </Pressable>

        {isExpanded ? (
          <View className="px-4 pb-4 border-t border-zinc-800">
            {survey.description ? (
              <Text className="text-zinc-400 text-sm mt-3 mb-3">{survey.description}</Text>
            ) : null}

            <Text className="text-zinc-500 text-xs uppercase tracking-wider mb-2 mt-2">
              {survey.questions.length} Question{survey.questions.length !== 1 ? 's' : ''}
            </Text>

            {survey.questions.map((q, i) => (
              <View key={q.id || i} className="bg-zinc-800 rounded-lg p-3 mb-2">
                <Text className="text-white text-sm mb-1">
                  {i + 1}. {q.questionText}
                </Text>
                <Text className="text-zinc-500 text-xs">
                  {q.options.length} options | {q.isRequired ? 'Required' : 'Optional'}
                </Text>
              </View>
            ))}

            {/* View Results Button */}
            <Pressable
              onPress={() => router.push(`/admin/survey-results?slug=${survey.slug}`)}
              className="flex-row items-center justify-center bg-purple-500/20 py-3 rounded-xl mt-4"
            >
              <BarChart3 size={16} color="#a855f7" />
              <Text className="text-purple-500 font-medium ml-2">View Results (Pie Charts)</Text>
            </Pressable>

            <View className="flex-row gap-2 mt-3">
              <Pressable
                onPress={() => handleEditSurvey(survey)}
                className="flex-1 flex-row items-center justify-center bg-zinc-800 py-3 rounded-xl"
              >
                <Edit3 size={16} color="#3b82f6" />
                <Text className="text-blue-500 font-medium ml-2">Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => toggleSurveyActive(survey)}
                disabled={updateSurveyMutation.isPending}
                className="flex-1 flex-row items-center justify-center bg-zinc-800 py-3 rounded-xl"
              >
                {updateSurveyMutation.isPending ? (
                  <ActivityIndicator size="small" color="#71717a" />
                ) : (
                  <>
                    <Check size={16} color={survey.isActive ? '#f59e0b' : '#22c55e'} />
                    <Text className={cn(
                      'font-medium ml-2',
                      survey.isActive ? 'text-amber-500' : 'text-green-500'
                    )}>
                      {survey.isActive ? 'Deactivate' : 'Activate'}
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => handleDeleteSurvey(survey)}
                className="flex-row items-center justify-center bg-red-500/10 px-4 py-3 rounded-xl"
              >
                <Trash2 size={16} color="#ef4444" />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

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
            <Text className="text-zinc-400 mt-4">Loading surveys...</Text>
          </View>
        ) : (
          <>
            {/* Active Surveys */}
            <View className="mb-6">
              <Text className="text-white text-lg font-semibold mb-3">Active Surveys</Text>
              {activeSurveys.length > 0 ? (
                activeSurveys.map(renderSurveyCard)
              ) : (
                <View className="bg-zinc-900 rounded-2xl p-6 items-center">
                  <Text className="text-zinc-500">No active survey types</Text>
                  <Text className="text-zinc-600 text-sm mt-1">
                    Create a new survey type to get started
                  </Text>
                </View>
              )}
            </View>

            {/* Inactive Surveys */}
            {inactiveSurveys.length > 0 ? (
              <View className="mb-6">
                <Text className="text-zinc-400 text-lg font-semibold mb-3">Inactive Surveys</Text>
                {inactiveSurveys.map(renderSurveyCard)}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* New Survey Button */}
      <View className="p-4 border-t border-zinc-800">
        <Pressable
          onPress={() => setShowNewSurveyModal(true)}
          className="flex-row items-center justify-center bg-blue-600 py-4 rounded-xl active:bg-blue-700"
        >
          <Plus size={20} color="#fff" />
          <Text className="text-white font-semibold ml-2">New Survey Type</Text>
        </Pressable>
      </View>

      {/* New Survey Modal */}
      <Modal
        visible={showNewSurveyModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewSurveyModal(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-zinc-900 rounded-t-3xl max-h-[90%]">
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
              <Text className="text-xl font-bold text-white">New Survey Type</Text>
              <Pressable
                onPress={() => {
                  resetNewSurveyForm();
                  setShowNewSurveyModal(false);
                }}
                className="p-2"
              >
                <X size={24} color="#a1a1aa" />
              </Pressable>
            </View>

            <ScrollView className="px-6 py-4">
              {/* Slug */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Slug *</Text>
                <TextInput
                  value={newSlug}
                  onChangeText={setNewSlug}
                  placeholder="e.g., marijuana, alcohol"
                  placeholderTextColor="#52525b"
                  autoCapitalize="none"
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white"
                />
                <Text className="text-zinc-600 text-xs mt-1">
                  Lowercase letters, numbers, and hyphens only
                </Text>
              </View>

              {/* Name */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Name *</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="e.g., Marijuana Survey"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white"
                />
              </View>

              {/* Description */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Description</Text>
                <TextInput
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Optional description"
                  placeholderTextColor="#52525b"
                  multiline
                  numberOfLines={3}
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white"
                  style={{ textAlignVertical: 'top', minHeight: 80 }}
                />
              </View>

              {/* Questions */}
              {renderQuestionEditor(newQuestions, setNewQuestions)}

              {/* Create Button */}
              <Pressable
                onPress={handleCreateSurvey}
                disabled={createSurveyMutation.isPending}
                className="bg-blue-600 py-4 rounded-xl items-center mb-8 active:bg-blue-700"
              >
                {createSurveyMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Create Survey Type</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Survey Modal */}
      <Modal
        visible={showEditSurveyModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowEditSurveyModal(false);
          setSelectedSurvey(null);
        }}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-zinc-900 rounded-t-3xl max-h-[90%]">
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
              <Text className="text-xl font-bold text-white">Edit Survey Type</Text>
              <Pressable
                onPress={() => {
                  setShowEditSurveyModal(false);
                  setSelectedSurvey(null);
                }}
                className="p-2"
              >
                <X size={24} color="#a1a1aa" />
              </Pressable>
            </View>

            <ScrollView className="px-6 py-4">
              {/* Slug (read-only) */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Slug</Text>
                <View className="bg-zinc-800/50 rounded-xl px-4 py-3">
                  <Text className="text-zinc-500">{selectedSurvey?.slug}</Text>
                </View>
                <Text className="text-zinc-600 text-xs mt-1">
                  Slug cannot be changed
                </Text>
              </View>

              {/* Name */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Name *</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Survey name"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white"
                />
              </View>

              {/* Description */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Description</Text>
                <TextInput
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Optional description"
                  placeholderTextColor="#52525b"
                  multiline
                  numberOfLines={3}
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white"
                  style={{ textAlignVertical: 'top', minHeight: 80 }}
                />
              </View>

              {/* Questions */}
              {renderQuestionEditor(editQuestions, setEditQuestions)}

              {/* Update Button */}
              <Pressable
                onPress={handleUpdateSurvey}
                disabled={updateSurveyMutation.isPending}
                className="bg-blue-600 py-4 rounded-xl items-center mb-8 active:bg-blue-700"
              >
                {updateSurveyMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Update Survey Type</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
