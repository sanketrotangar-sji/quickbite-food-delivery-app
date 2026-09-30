import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function OrderIdLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="map" options={{ animation: 'fade', presentation: 'card' }} />
    </Stack>
  );
}
