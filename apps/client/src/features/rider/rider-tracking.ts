import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useSyncExternalStore } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { updateRiderLocation } from '@/api/rider';
import { isExpoGo } from '@/lib/runtime';

const LOCATION_TASK = 'quickbite-rider-location';
const ACTIVE_ORDER_KEY = '@quickbite/rider-active-order';
const UPDATE_INTERVAL_MS = 60_000;

export type RiderCoordinate = {
  latitude: number;
  longitude: number;
};

type TrackingSnapshot = {
  coordinate: RiderCoordinate | null;
  error: string | null;
  tracking: boolean;
};

let activeOrderId: string | null = null;
let foregroundWatcher: Location.LocationSubscription | null = null;
let startPromise: Promise<void> | null = null;
let snapshot: TrackingSnapshot = { coordinate: null, error: null, tracking: false };
const listeners = new Set<() => void>();

function emit(next: Partial<TrackingSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

async function sendLocation(orderId: string, location: Location.LocationObject) {
  const coordinate = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
  emit({ coordinate, error: null });
  await updateRiderLocation(orderId, coordinate.latitude, coordinate.longitude);
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  LOCATION_TASK,
  async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const orderId = activeOrderId ?? (await AsyncStorage.getItem(ACTIVE_ORDER_KEY));
    if (!orderId) return;
    const latest = data.locations[data.locations.length - 1];
    if (!latest) return;
    try {
      await sendLocation(orderId, latest);
    } catch {
      // The next scheduled update retries; terminal order states are reconciled by the app.
    }
  },
);

async function startForegroundWatcher() {
  foregroundWatcher?.remove();
  foregroundWatcher = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: UPDATE_INTERVAL_MS,
      distanceInterval: 0,
    },
    (location) => {
      if (!activeOrderId) return;
      void sendLocation(activeOrderId, location).catch((error: unknown) => {
        emit({ error: error instanceof Error ? error.message : 'Location update failed.' });
      });
    },
  );
}

async function startNativeTracking(orderId: string) {
  if (Platform.OS === 'web' || isExpoGo()) {
    emit({
      error: 'Live rider tracking needs an EAS development or preview build. Expo Go cannot run background GPS.',
    });
    return;
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    emit({ error: 'Location permission is required for active deliveries.' });
    return;
  }

  if (AppState.currentState === 'active') await startForegroundWatcher();

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.granted && !(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: UPDATE_INTERVAL_MS,
      distanceInterval: 0,
      deferredUpdatesInterval: UPDATE_INTERVAL_MS,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'QuickBite delivery in progress',
        notificationBody: 'Sharing your location for this active order.',
        killServiceOnDestroy: false,
      },
    });
  } else if (!background.granted) {
    emit({ error: 'Background location is off. Tracking continues only while QuickBite is open.' });
  }
}

export async function startRiderTracking(orderId: string) {
  if (activeOrderId === orderId && snapshot.tracking) return;
  activeOrderId = orderId;
  await AsyncStorage.setItem(ACTIVE_ORDER_KEY, orderId);
  emit({ tracking: true, error: null });
  if (!startPromise) {
    startPromise = startNativeTracking(orderId).finally(() => {
      startPromise = null;
    });
  }
  await startPromise;
}

export async function restoreRiderTracking() {
  const orderId = await AsyncStorage.getItem(ACTIVE_ORDER_KEY);
  if (orderId) await startRiderTracking(orderId);
}

export async function stopRiderTracking(orderId?: string) {
  const stored = activeOrderId ?? (await AsyncStorage.getItem(ACTIVE_ORDER_KEY));
  if (orderId && stored && stored !== orderId) return;
  activeOrderId = null;
  foregroundWatcher?.remove();
  foregroundWatcher = null;
  if (Platform.OS !== 'web' && (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  await AsyncStorage.removeItem(ACTIVE_ORDER_KEY);
  emit({ tracking: false, coordinate: null, error: null });
}

function onAppStateChange(state: AppStateStatus) {
  if (state === 'active' && activeOrderId && !foregroundWatcher) {
    void startForegroundWatcher();
  } else if (state !== 'active') {
    foregroundWatcher?.remove();
    foregroundWatcher = null;
  }
}

AppState.addEventListener('change', onAppStateChange);

export function useRiderTracking() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}
