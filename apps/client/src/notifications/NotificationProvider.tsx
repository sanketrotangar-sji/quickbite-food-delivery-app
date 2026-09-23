import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { supportsRemotePush } from '@/lib/runtime';
import { routeFromNotification } from '@/notifications/routes';

const CHANNEL_ID = 'orders';

type NotificationsModule = typeof import('expo-notifications');
type NotificationResponse = import('expo-notifications').NotificationResponse;

let notificationsModule: NotificationsModule | null | undefined;
let handlerConfigured = false;

function getNotifications(): NotificationsModule | null {
  if (!supportsRemotePush()) return null;
  if (notificationsModule !== undefined) return notificationsModule;
  try {
    // Lazy load so Expo Go never evaluates the removed Android push path at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require('expo-notifications') as NotificationsModule;
  } catch (error) {
    console.warn('Push notifications unavailable in this runtime.', error);
    notificationsModule = null;
  }
  return notificationsModule;
}

function ensureNotificationHandler(Notifications: NotificationsModule) {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function getProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function registerCurrentDeviceForPush() {
  const Notifications = getNotifications();
  if (!Notifications || !Device.isDevice) return null;
  ensureNotificationHandler(Notifications);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E85D04',
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('Push registration skipped: EAS projectId is missing.');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc('register_push_device', {
    p_token: token,
    p_platform: Platform.OS as 'ios' | 'android',
    p_metadata: {
      device_name: Device.deviceName,
      model_name: Device.modelName,
      os_name: Device.osName,
      os_version: Device.osVersion,
    },
  });
  if (error) throw new Error(error.message);
  return token;
}

export async function getPushNotificationsEnabled() {
  if (!supportsRemotePush()) return false;
  const Notifications = getNotifications();
  if (!Notifications) return false;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return false;
  const { data, error } = await supabase
    .from('push_device_tokens')
    .select('enabled')
    .eq('enabled', true)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function setPushNotificationsEnabled(enabled: boolean) {
  if (enabled) {
    if (!supportsRemotePush()) {
      throw new Error('Push notifications need an EAS development or preview build.');
    }
    const token = await registerCurrentDeviceForPush();
    return Boolean(token);
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { error } = await supabase
    .from('push_device_tokens')
    .update({ enabled: false })
    .eq('user_id', data.user.id);
  if (error) throw new Error(error.message);
  return false;
}

async function disableTokenWithSession(token: string, userId: string, accessToken: string) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return;

  await fetch(
    `${url}/rest/v1/push_device_tokens?token=eq.${encodeURIComponent(token)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ enabled: false }),
    },
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const authRef = useRef<{ userId: string; accessToken: string } | null>(null);
  const handledResponses = useRef(new Set<string>());
  const pendingRoute = useRef<Href | null>(null);

  const handleResponse = useCallback(
    (response: NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledResponses.current.has(id)) return;
      handledResponses.current.add(id);

      const route = routeFromNotification(
        (response.notification.request.content.data ?? {}) as Record<string, unknown>,
      );
      if (!route) return;
      if (session) router.push(route);
      else pendingRoute.current = route;
    },
    [router, session],
  );

  useEffect(() => {
    if (!session || !pendingRoute.current) return;
    const route = pendingRoute.current;
    pendingRoute.current = null;
    router.push(route);
  }, [router, session]);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return;
    ensureNotificationHandler(Notifications);
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    void Notifications.getLastNotificationResponseAsync().then(handleResponse);
    return () => responseSubscription.remove();
  }, [handleResponse]);

  useEffect(() => {
    if (!session) return;
    authRef.current = {
      userId: session.user.id,
      accessToken: session.access_token,
    };

    let cancelled = false;
    void registerCurrentDeviceForPush()
      .then((token) => {
        if (!cancelled) tokenRef.current = token;
      })
      .catch((error: unknown) => {
        console.warn('Push registration failed.', error);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, session?.user.id]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      const token = tokenRef.current;
      const auth = authRef.current;
      tokenRef.current = null;
      authRef.current = null;
      if (token && auth) {
        void disableTokenWithSession(token, auth.userId, auth.accessToken).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return children;
}
