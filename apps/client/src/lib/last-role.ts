import AsyncStorage from '@react-native-async-storage/async-storage';

import { storage } from '@/lib/storage';

const KEY = 'qb.lastRole';

export type AppSide = 'customer' | 'rider';

function parse(value: string | null | undefined): AppSide | null {
  return value === 'rider' || value === 'customer' ? value : null;
}

export function getLastRole(): AppSide | null {
  return parse(storage.getString(KEY));
}

export async function readLastRole(): Promise<AppSide | null> {
  const current = getLastRole();
  if (current) return current;
  const legacy = parse(await AsyncStorage.getItem(KEY));
  if (legacy) storage.set(KEY, legacy);
  return legacy;
}

export async function rememberRole(role: AppSide) {
  storage.set(KEY, role);
}
