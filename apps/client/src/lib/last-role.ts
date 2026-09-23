import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'qb.lastRole';

export type AppSide = 'customer' | 'rider';

export async function readLastRole(): Promise<AppSide | null> {
  const value = await AsyncStorage.getItem(KEY);
  return value === 'rider' || value === 'customer' ? value : null;
}

export async function rememberRole(role: AppSide) {
  await AsyncStorage.setItem(KEY, role);
}
