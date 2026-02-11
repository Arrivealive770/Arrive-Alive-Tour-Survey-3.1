import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { Calendar, BarChart3, LogOut } from 'lucide-react-native';
import { cn } from '@/lib/cn';

// Import the actual screens as components
import EventsScreen from './events';
import AnalyticsScreen from './analytics';

type TabType = 'events' | 'stats';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('events');

  const handleLogout = () => {
    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Text className="text-2xl font-bold text-white">Admin Dashboard</Text>
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center px-4 py-2 bg-zinc-800 rounded-lg active:bg-zinc-700"
        >
          <LogOut size={18} color="#ef4444" />
          <Text className="text-red-500 ml-2 font-medium">Logout</Text>
        </Pressable>
      </View>

      {/* Tab Bar */}
      <View className="flex-row border-b border-zinc-800">
        <Pressable
          onPress={() => setActiveTab('events')}
          className={cn(
            'flex-1 flex-row items-center justify-center py-4',
            activeTab === 'events' ? 'border-b-2 border-white' : ''
          )}
        >
          <Calendar size={20} color={activeTab === 'events' ? '#fff' : '#71717a'} />
          <Text
            className={cn(
              'ml-2 font-medium',
              activeTab === 'events' ? 'text-white' : 'text-zinc-500'
            )}
          >
            Events
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('stats')}
          className={cn(
            'flex-1 flex-row items-center justify-center py-4',
            activeTab === 'stats' ? 'border-b-2 border-white' : ''
          )}
        >
          <BarChart3 size={20} color={activeTab === 'stats' ? '#fff' : '#71717a'} />
          <Text
            className={cn(
              'ml-2 font-medium',
              activeTab === 'stats' ? 'text-white' : 'text-zinc-500'
            )}
          >
            Stats
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <View className="flex-1">
        {activeTab === 'events' ? <EventsScreen /> : <AnalyticsScreen />}
      </View>
    </SafeAreaView>
  );
}
