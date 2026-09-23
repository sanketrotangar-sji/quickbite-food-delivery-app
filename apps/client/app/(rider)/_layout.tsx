import { Redirect, Stack } from 'expo-router';

import { LogoLoader } from '@/components/LogoLoader';
import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { hasRole } from '@/types/models';

export default function RiderLayout() {
  const { profile, loading } = useAuth();
  if (loading) return <LogoLoader />;
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
