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

import { AnimatedSplash } from '@/components/AnimatedSplash';
import { colors } from '@/constants/theme';
import { useRiderOrdersRealtime } from '@/features/rider/use-rider-live';
import { AddressesProvider } from '@/hooks/useAddresses';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useLiveKitchen } from '@/hooks/useLiveKitchen';
import { SavedHeartsProvider } from '@/hooks/useSavedHearts';
import { captureException } from '@/lib/sentry';
import { NotificationProvider } from '@/notifications/NotificationProvider';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(colors.background);

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
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

  useEffect(() => {
    type Handler = (error: Error, isFatal?: boolean) => void;
    const utils = (
      globalThis as { ErrorUtils?: { getGlobalHandler?: () => Handler; setGlobalHandler?: (h: Handler) => void } }
    ).ErrorUtils;
    if (!utils?.getGlobalHandler || !utils.setGlobalHandler) return;
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error, isFatal) => {
      void captureException(error, { source: 'ErrorUtils', isFatal: Boolean(isFatal) });
      previous?.(error, isFatal);
    });
    return () => {
      utils.setGlobalHandler?.(previous);
    };
  }, []);

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
  const [splashFinished, setSplashFinished] = useState(false);
  useLiveKitchen();
  useRiderOrdersRealtime();

  const isAuthed = !!session;

  // Gate the navigator until splash finishes so login/home never peek under the brand animation.
  const showApp = splashFinished && !loading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {showApp ? (
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
      ) : null}
      {!splashFinished ? (
        <AnimatedSplash
          isReady={!loading}
          onAnimationComplete={() => setSplashFinished(true)}
        />
      ) : null}
    </View>
  );
}
