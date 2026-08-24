import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, router } from 'expo-router';
import { LayoutDashboard, Calendar, Tablet, Settings, ClipboardList, FileUp, ShieldOff, ArrowLeft } from 'lucide-react-native';
import { PINEntry } from '@/components/admin/PINEntry';
import { HomeHeaderButton } from '@/components/common/HomeHeaderButton';
import { useDeviceStore } from '@/lib/state/device-store';
import { useTeamAdminAccess } from '@/lib/team-access';

/** Shown to a field team that tapped through to Admin. No PIN box, on purpose. */
function AdminRestricted({ teamName }: { teamName: string | null }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <ShieldOff size={40} color="#ef4444" />
        </View>

        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' }}>
          Admin is restricted
        </Text>

        <Text
          style={{
            color: '#a1a1aa',
            fontSize: 15,
            lineHeight: 22,
            textAlign: 'center',
            marginTop: 12,
          }}
        >
          {teamName
            ? `${teamName} is a field team, so this device can run surveys and pledge photos but can't open Admin.`
            : "This device's team isn't an admin team, so it can run surveys and pledge photos but can't open Admin."}
        </Text>

        <Text
          style={{
            color: '#71717a',
            fontSize: 13,
            lineHeight: 20,
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          To change this, mark the team as an admin team in the admin portal, then reopen this screen.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 32,
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: pressed ? '#27272a' : '#18181b',
            borderWidth: 1,
            borderColor: '#3f3f46',
          })}
        >
          <ArrowLeft size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Back to home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function AdminLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const adminPin = useDeviceStore((s) => s.adminPin);
  // First gate: is this team allowed in at all? The PIN is only the second gate,
  // so a field team never even sees a box to guess a PIN into.
  const { isAdminTeam, teamName, isChecking } = useTeamAdminAccess();

  const handlePinComplete = (enteredPin: string): boolean => {
    if (enteredPin === adminPin) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  if (isChecking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={{ color: '#71717a', fontSize: 14 }}>Checking access…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdminTeam) {
    return <AdminRestricted teamName={teamName} />;
  }

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
        // Admin is a tab bar with no back arrow of its own, so every tab keeps
        // a way out to the main menu.
        headerLeft: () => <HomeHeaderButton />,
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
        name="survey-imports"
        options={{
          title: 'Imports',
          tabBarIcon: ({ color, size }) => (
            <FileUp size={size} color={color} />
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
      {/* These two draw their own "back to Dashboard" bar, so no Menu button. */}
      <Tabs.Screen
        name="analytics"
        options={{
          href: null, // Hide from tab bar
          title: 'Analytics',
          headerLeft: () => null,
        }}
      />
      <Tabs.Screen
        name="survey-results"
        options={{
          href: null, // Hide from tab bar
          title: 'Survey Results',
          headerLeft: () => null,
        }}
      />
    </Tabs>
  );
}
