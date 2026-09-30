import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setRiderDuty } from '@/api/rider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, screenTopGap, tabBarInset } from '@/constants/theme';
import { CurrentOrderCard } from '@/features/rider/components/CurrentOrderCard';
import { NearbyOrderCard } from '@/features/rider/components/NearbyOrderCard';
import { RiderHeader } from '@/features/rider/components/RiderHeader';
import { RiderHero } from '@/features/rider/components/RiderHero';
import { RiderStatsRow } from '@/features/rider/components/RiderStatsRow';
import { stopRiderTracking, useRiderTracking } from '@/features/rider/rider-tracking';
import { pickActive, todayStats, toCurrentOrder, toNearbyOrder, useClaimDelivery, useRiderOrders } from '@/features/rider/use-rider-live';
import { useAuth } from '@/hooks/useAuth';
import { greetingName } from '@/lib/home-mock';

export function RiderHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const orders = useRiderOrders();
  const claim = useClaimDelivery();
  const tracking = useRiderTracking();
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

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + screenTopGap }]}>
        <RiderHeader online={online} onChange={(next) => void setDuty(next)} />
        {tracking.error ? (
          <View style={styles.locationBanner}>
            <AppText weight="semibold" style={styles.locationBannerText}>
              {tracking.error}
            </AppText>
            <AppText muted style={styles.locationBannerHint}>
              Allow location for QuickBite in system settings so live delivery GPS can share.
            </AppText>
          </View>
        ) : null}
        {orders.isLoading && !orders.data ? (
          <>
            <RiderHero name={firstName} />
            <LoadingSkeleton variant="feature" rows={1} />
            <LoadingSkeleton rows={2} />
          </>
        ) : null}
        {orders.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load your shift"
            body="Nearby requests didn't come through. Try again in a moment."
            actionLabel="Try again"
            onAction={() => void orders.refetch()}
          />
        ) : null}
        {!orders.isError && orders.data ? (
          <>
            <RiderHero name={firstName} />
            {active ? (
              <CurrentOrderCard order={toCurrentOrder(active)} riderCoordinate={tracking.coordinate} />
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
  locationBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    padding: 12,
    gap: 4,
  },
  locationBannerText: { fontSize: 13, color: colors.text },
  locationBannerHint: { fontSize: 12 },
});
