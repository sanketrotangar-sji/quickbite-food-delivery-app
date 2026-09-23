import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { colors } from '@/constants/theme';
import { useRiderOrdersRealtime } from '@/features/rider/use-rider-live';
import { AddressesProvider } from '@/hooks/useAddresses';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useLiveKitchen } from '@/hooks/useLiveKitchen';
import { SavedHeartsProvider } from '@/hooks/useSavedHearts';
import { NotificationProvider } from '@/notifications/NotificationProvider';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(colors.background);

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
      }),
  );
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <KeyboardProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NotificationProvider>
              <AddressesProvider>
                <SavedHeartsProvider>
                  <StatusBar style="dark" />
                  {Platform.OS === 'android' ? <NavigationBar style="light" /> : null}
                  <RootNav />
                </SavedHeartsProvider>
              </AddressesProvider>
            </NotificationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </View>
    </KeyboardProvider>
  );
}

function RootNav() {
  const { session, loading } = useAuth();
  useLiveKitchen();
  useRiderOrdersRealtime();
  if (loading) return null;

  const isAuthed = !!session;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Protected guard={!isAuthed}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      {/* Any signed-in role can browse, cart, order, and rate. Those actions are not role-gated. */}
      <Stack.Protected guard={isAuthed}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
      {/* Mounted for every session so a non-rider gets the blocked screen instead of a blank route. */}
      <Stack.Protected guard={isAuthed}>
        <Stack.Screen name="(rider)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthed}>
        <Stack.Screen name="(blocked)" />
      </Stack.Protected>
      <Stack.Screen name="index" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
