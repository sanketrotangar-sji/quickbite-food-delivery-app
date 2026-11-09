import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Toaster } from 'sonner-native';

import { AuthGateProvider } from '@/features/auth/hooks';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { colors } from '@/constants/theme';
import { useRiderOrdersRealtime } from '@/features/rider/use-rider-live';
import { AddressesProvider } from '@/features/addresses/hooks';
import { prefetchHomeFeed } from '@/features/home/hooks';
import { useSyncSelectedAddress } from '@/features/location/hooks';
import { useLocationStore } from '@/features/location/store';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useLiveKitchen } from '@/hooks/useLiveKitchen';
import { SavedHeartsProvider } from '@/features/profile/useSavedHearts';
import { readLastRole } from '@/lib/last-role';
import { bindOnlineManager } from '@/lib/network';
import { captureException } from '@/lib/sentry';
import { NotificationProvider } from '@/notifications/NotificationProvider';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(colors.background);
bindOnlineManager();

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
      globalThis as {
        ErrorUtils?: {
          getGlobalHandler?: () => Handler;
          setGlobalHandler?: (h: Handler) => void;
        };
      }
    ).ErrorUtils;
    if (!utils?.getGlobalHandler || !utils.setGlobalHandler) return;
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error, isFatal) => {
      void captureException(error, {
        source: 'ErrorUtils',
        isFatal: Boolean(isFatal),
      });
      previous?.(error, isFatal);
    });
    return () => {
      utils.setGlobalHandler?.(previous);
    };
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AuthGateProvider>
                <NotificationProvider>
                  <AddressesProvider>
                    <SavedHeartsProvider>
                      <BottomSheetModalProvider>
                        <StatusBar style="dark" />
                        {Platform.OS === 'android' ? <NavigationBar style="light" /> : null}
                        <RootNav />
                        <Toaster position="top-center" richColors closeButton={false} />
                      </BottomSheetModalProvider>
                    </SavedHeartsProvider>
                  </AddressesProvider>
                </NotificationProvider>
              </AuthGateProvider>
            </AuthProvider>
          </QueryClientProvider>
        </View>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootNav() {
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();
  const [splashFinished, setSplashFinished] = useState(false);
  useLiveKitchen();
  useRiderOrdersRealtime();
  useSyncSelectedAddress();

  useEffect(() => {
    void readLastRole();
    const point = useLocationStore.getState().point;
    if (point) void prefetchHomeFeed(queryClient, point);
  }, [queryClient]);

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
          {/* Customer screens are open to all users for guest browsing */}
          <Stack.Screen name="(customer)" />
          {/* Auth stack is available for sign-in, sign-up, and account switching */}
          <Stack.Screen name="(auth)" />
          {/* Rider and blocked screens require an authenticated session */}
          <Stack.Protected guard={isAuthed}>
            <Stack.Screen name="(rider)" />
          </Stack.Protected>
          <Stack.Protected guard={isAuthed}>
            <Stack.Screen name="(blocked)" />
          </Stack.Protected>
          <Stack.Screen name="index" />
          <Stack.Screen name="location" options={{ gestureEnabled: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      ) : null}
      {!splashFinished ? (
        <AnimatedSplash isReady={!loading} onAnimationComplete={() => setSplashFinished(true)} />
      ) : null}
    </View>
  );
}
