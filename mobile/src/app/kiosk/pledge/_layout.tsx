import { View, StatusBar } from 'react-native';
import { Stack } from 'expo-router';

export default function PledgeLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'fade',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="email" />
        <Stack.Screen name="thank-you" />
      </Stack>
    </View>
  );
}
