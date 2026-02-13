import { useState } from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, Calendar, Tablet, Settings, ClipboardList } from 'lucide-react-native';
import { PINEntry } from '@/components/admin/PINEntry';
import { useDeviceStore } from '@/lib/state/device-store';

export default function AdminLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const adminPin = useDeviceStore((s) => s.adminPin);

  const handlePinComplete = (enteredPin: string): boolean => {
    if (enteredPin === adminPin) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  // Show PIN entry if not authenticated
  if (!isAuthenticated) {
    return (
      <PINEntry
        onComplete={handlePinComplete}
        title="Admin Access"
        subtitle="Enter your PIN to continue"
      />
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#27272a',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#71717a',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'Admin Dashboard',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Devices',
          tabBarIcon: ({ color, size }) => (
            <Tablet size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="surveys"
        options={{
          title: 'Surveys',
          tabBarIcon: ({ color, size }) => (
            <ClipboardList size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
      {/* Hidden screens accessible from other tabs */}
      <Tabs.Screen
        name="analytics"
        options={{
          href: null, // Hide from tab bar
          title: 'Analytics',
        }}
      />
      <Tabs.Screen
        name="survey-results"
        options={{
          href: null, // Hide from tab bar
          title: 'Survey Results',
        }}
      />
    </Tabs>
  );
}
