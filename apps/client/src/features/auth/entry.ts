import type { Href } from 'expo-router';

import type { AppSide } from '@/lib/last-role';

export type EntryInput = {
  hasSession: boolean;
  canRide: boolean;
  lastRole: AppSide | null;
  hasLocation: boolean;
  loginSkipped: boolean;
};

export type EntryRoute = 'login' | 'rider' | 'location' | 'home';

/** Where a cold start lands. Pure so it can be tested and reused by deep links. */
export function resolveEntryRoute(input: EntryInput): EntryRoute {
  if (!input.hasSession && !input.loginSkipped) return 'login';
  if (input.hasSession && input.lastRole === 'rider' && input.canRide) return 'rider';
  if (!input.hasLocation) return 'location';
  return 'home';
}

export function entryHref(route: EntryRoute): Href {
  switch (route) {
    case 'login':
      return { pathname: '/(auth)/login', params: { entry: '1' } };
    case 'rider':
      return '/(rider)/(tabs)';
    case 'location':
      // Cast until expo-router regenerates typed routes for app/location.tsx.
      return '/location' as Href;
    case 'home':
      return '/(customer)/(tabs)';
  }
}
