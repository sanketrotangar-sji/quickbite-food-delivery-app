import { Tabs, useSegments } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';

import { setRiderDuty } from '@/api/rider';
import { CustomerTabBar } from '@/components/home/CustomerTabBar';
import { colors } from '@/constants/theme';
import { stopRiderTracking } from '@/features/rider/rider-tracking';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerOrdersRealtime } from '@/hooks/useOrderTracking';
import { rememberRole } from '@/lib/last-role';
import { hasRole } from '@/types/models';

export default function CustomerTabs() {
  const { profile, refreshProfile } = useAuth();
  const segments = useSegments();
  const onCustomerSide = segments[0] === '(customer)';
  useCustomerOrdersRealtime();

  useEffect(() => {
    if (onCustomerSide) void rememberRole('customer');
  }, [onCustomerSide]);

  // Riders may order as customers, but only the active customer side may force duty off.
  // A mounted-but-covered customer stack must not undo Start duty on the rider screens.
  useEffect(() => {
    if (!onCustomerSide) return;
    if (!profile?.id || !hasRole(profile, 'rider') || !profile.is_online) return;
    void setRiderDuty(false)
      .then(async () => {
        await stopRiderTracking();
        await refreshProfile();
      })
      .catch(() => {
        // The rider screen surfaces duty errors; customer browsing should remain usable.
      });
  }, [onCustomerSide, profile, refreshProfile]);

  return (
    <Tabs
      tabBar={(props) => {
        const barProps = {
          state: props.state,
          descriptors: props.descriptors,
          navigation: props.navigation,
        };
        return <CustomerTabBar {...(barProps as ComponentProps<typeof CustomerTabBar>)} />;
      }}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        lazy: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="picks" options={{ title: 'Explore' }} />
      <Tabs.Screen name="reorder" options={{ title: 'Orders' }} />
      <Tabs.Screen name="assistant" options={{ title: 'RIO' }} />
      <Tabs.Screen name="settings" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
