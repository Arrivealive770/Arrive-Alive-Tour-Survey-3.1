import { Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { usePhotoQueueCount } from '@/lib/state/photo-store';

function QueueBadge() {
  const queueCount = usePhotoQueueCount();

  if (queueCount === 0) return null;

  return (
    <View
      style={{
        backgroundColor: '#ef4444',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
        {queueCount > 99 ? '99+' : queueCount}
      </Text>
    </View>
  );
}

export default function PhotoHubLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#000' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Photo Hub',
          headerRight: () => <QueueBadge />,
        }}
      />
      <Stack.Screen
        name="queue"
        options={{
          title: 'Photo Queue',
        }}
      />
      <Stack.Screen
        name="overlay-select"
        options={{
          title: 'Select Overlay',
          presentation: 'modal',
          headerStyle: { backgroundColor: '#18181b' },
        }}
      />
    </Stack>
  );
}
