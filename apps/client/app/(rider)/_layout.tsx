import { Redirect, Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { hasRole } from '@/types/models';

export default function RiderLayout() {
  const { profile, loading } = useAuth();
  // Root splash covers cold start; after sign-in the profile is already loaded.
  if (loading) return null;
  if (!hasRole(profile, 'rider')) return <Redirect href="/(blocked)/rider" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="delivery" />
      <Stack.Screen name="help" />
      <Stack.Screen name="report" />
      <Stack.Screen name="personal" />
      <Stack.Screen name="vehicle" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="preferences" />
    </Stack>
  );
}
