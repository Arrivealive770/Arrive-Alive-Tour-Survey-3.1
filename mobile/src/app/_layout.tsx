import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DatabaseProvider } from '@/providers/DatabaseProvider';
import { SyncProvider } from '@/providers/SyncProvider';

export const unstable_settings = {
  // Start at the main index which handles routing based on device config
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <DatabaseProvider>
        <SyncProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                <Slot />
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SyncProvider>
      </DatabaseProvider>
    </QueryClientProvider>
  );
}