import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DatabaseProvider } from '@/providers/DatabaseProvider';
import { SyncProvider } from '@/providers/SyncProvider';
import { EventWatcherProvider } from '@/providers/EventWatcherProvider';

export const unstable_settings = {
  // Start at the main index which handles routing based on device config
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
// Must be caught: in a standalone build this rejects if the splash is already gone.
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

/**
 * Rendered by Expo Router if any screen throws while rendering. Without this,
 * a crash in a release build leaves the user staring at a blank white screen.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#000', padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 12 }}>
        Something went wrong
      </Text>
      <ScrollView style={{ maxHeight: 260, marginBottom: 20 }}>
        <Text style={{ color: '#a1a1aa', fontSize: 14 }}>{error?.message ?? 'Unknown error'}</Text>
      </ScrollView>
      <Text
        onPress={() => {
          retry().catch(() => {});
        }}
        style={{
          color: '#000',
          backgroundColor: '#fff',
          fontSize: 17,
          fontWeight: '600',
          textAlign: 'center',
          paddingVertical: 14,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        Try again
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Hide the native splash once the JS bundle has mounted. This is deliberately
  // NOT tied to database/sync readiness — if those fail, the app must still show
  // its UI (or the error state) rather than an endless blank splash.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <DatabaseProvider>
        <SyncProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                <EventWatcherProvider>
                  <Slot />
                </EventWatcherProvider>
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SyncProvider>
      </DatabaseProvider>
    </QueryClientProvider>
  );
}