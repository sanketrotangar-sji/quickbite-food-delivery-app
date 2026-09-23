import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setRiderDuty } from '@/api/rider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { LogoLoader } from '@/components/LogoLoader';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, screenTopGap, tabBarInset } from '@/constants/theme';
import { CurrentOrderCard } from '@/features/rider/components/CurrentOrderCard';
import { NearbyOrderCard } from '@/features/rider/components/NearbyOrderCard';
import { RiderHeader } from '@/features/rider/components/RiderHeader';
import { RiderHero } from '@/features/rider/components/RiderHero';
import { RiderStatsRow } from '@/features/rider/components/RiderStatsRow';
import { stopRiderTracking } from '@/features/rider/rider-tracking';
import { pickActive, todayStats, toCurrentOrder, toNearbyOrder, useClaimDelivery, useRiderOrders } from '@/features/rider/use-rider-live';
import { useAuth } from '@/hooks/useAuth';
import { greetingName } from '@/lib/home-mock';

export function RiderHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const orders = useRiderOrders();
  const claim = useClaimDelivery();
  const [dutyBusy, setDutyBusy] = useState(false);
  const online = Boolean(profile?.is_online);
  const firstName = greetingName(profile?.full_name, profile?.email);
  const mine = orders.data?.mine ?? [];
  const active = pickActive(mine);
  const nearby = (orders.data?.available ?? []).map(toNearbyOrder);
  const stats = todayStats(orders.data?.history ?? [], active);

  async function setDuty(next: boolean) {
    if (!profile?.id || dutyBusy || next === online) return;
    setDutyBusy(true);
    try {
      await setRiderDuty(next);
      if (!next) await stopRiderTracking();
      await refreshProfile();
    } catch (error) {
      Alert.alert('Could not update duty', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setDutyBusy(false);
    }
  }

  if (orders.isLoading && !orders.data) {
    return <LogoLoader />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + screenTopGap }]}>
        <RiderHeader online={online} onChange={(next) => void setDuty(next)} />
        {orders.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load your shift"
            body="Nearby requests didn't come through. Try again in a moment."
            actionLabel="Try again"
            onAction={() => void orders.refetch()}
          />
        ) : null}
        {!orders.isError ? (
          <>
            <RiderHero name={firstName} />
            {active ? (
              <CurrentOrderCard order={toCurrentOrder(active)} />
            ) : (
              <AppText muted style={styles.none}>
                No active delivery right now.
              </AppText>
            )}
            <RiderStatsRow stats={stats} />
            <SectionHeader title="Nearby Orders" />
            {!online ? (
              <EmptyState
                icon="moon-outline"
                title="Off duty"
                body="Start duty when you want new delivery requests. An active order stays with you."
              />
            ) : nearby.length === 0 ? (
              <EmptyState
                icon="bicycle-outline"
                title="No requests nearby"
                body="New kitchens will show up here when an order is ready for a rider."
              />
            ) : (
              <View style={styles.list}>
                {nearby.map((order) => (
                  <NearbyOrderCard
                    key={order.id}
                    order={order}
                    onAccept={() => {
                      void claim.mutateAsync(order.id).catch((error: Error) => {
                        Alert.alert('Could not accept', error.message);
                      });
                    }}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: tabBarInset + 20, gap: 14 },
  none: { fontSize: 13 },
  list: { gap: 10, marginTop: -4 },
});
