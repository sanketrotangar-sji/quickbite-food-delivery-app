import { Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';

import { colors } from '@/constants/theme';
import { RiderTabBar } from '@/features/rider/RiderTabBar';
import { rememberRole } from '@/lib/last-role';

export default function RiderTabs() {
  useEffect(() => {
    void rememberRole('rider');
  }, []);

  return (
    <Tabs
      tabBar={(props) => {
        const barProps = {
          state: props.state,
          descriptors: props.descriptors,
          navigation: props.navigation,
        };
        return <RiderTabBar {...(barProps as ComponentProps<typeof RiderTabBar>)} />;
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
