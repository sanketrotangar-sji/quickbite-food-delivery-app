import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Expo Go does not ship push, MapLibre, or background location native code. */
export function isExpoGo() {
  return Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
}

export function supportsNativeMaps() {
  return Platform.OS !== 'web' && !isExpoGo();
}

export function supportsRemotePush() {
  return Platform.OS !== 'web' && !isExpoGo();
}
