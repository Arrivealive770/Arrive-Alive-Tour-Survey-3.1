import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function SetupLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="device-config" />
        <Stack.Screen name="event-setup" />
      </Stack>
    </>
  );
}
