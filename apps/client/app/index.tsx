import { Redirect } from 'expo-router';

import { entryHref, resolveEntryRoute } from '@/features/auth/entry';
import { useAuthPrefs } from '@/features/auth/store';
import { useLocationStore } from '@/features/location/store';
import { useAuth } from '@/hooks/useAuth';
import { getLastRole } from '@/lib/last-role';
import { hasRole } from '@/types/models';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const loginSkipped = useAuthPrefs((s) => s.loginSkipped);
  const hasLocation = useLocationStore((s) => s.point != null);

  // The root splash stays up until auth resolves, so nothing renders underneath.
  if (loading) return null;

  const route = resolveEntryRoute({
    hasSession: Boolean(session),
    canRide: hasRole(profile, 'rider'),
    lastRole: getLastRole(),
    hasLocation,
    loginSkipped,
  });
  return <Redirect href={entryHref(route)} />;
}
