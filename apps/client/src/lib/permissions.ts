import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export type PermissionKind = 'granted' | 'denied' | 'undetermined';

export function mapPermissionStatus(status: Location.PermissionStatus | string): PermissionKind {
  if (status === 'granted') return 'granted';
  if (status === 'undetermined') return 'undetermined';
  return 'denied';
}

export async function getForegroundLocationPermission(): Promise<PermissionKind> {
  const current = await Location.getForegroundPermissionsAsync();
  return mapPermissionStatus(current.status);
}

/** Request foreground location. Returns final kind after prompt. */
export async function ensureForegroundLocationPermission(): Promise<PermissionKind> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain && current.status !== 'undetermined') return 'denied';
  const next = await Location.requestForegroundPermissionsAsync();
  return mapPermissionStatus(next.status);
}

export async function openSystemAppSettings() {
  if (Platform.OS === 'ios') {
    await Linking.openURL('app-settings:');
    return;
  }
  await Linking.openSettings();
}
