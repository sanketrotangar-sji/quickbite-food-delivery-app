import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { setRiderDuty } from '@/api/rider';
import { userFacingMessage } from '@/api/errors';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { LocationPermissionGate } from '@/components/LocationPermissionGate';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, screenTopGap, tabBarInset } from '@/constants/theme';
import { CurrentOrderCard } from '@/features/rider/components/CurrentOrderCard';
import { NearbyOrderCard } from '@/features/rider/components/NearbyOrderCard';
import { RiderHeader } from '@/features/rider/components/RiderHeader';
import { RiderHero } from '@/features/rider/components/RiderHero';
import { RiderStatsRow } from '@/features/rider/components/RiderStatsRow';
import { stopRiderTracking, useRiderTracking } from '@/features/rider/rider-tracking';
import {
  pickActive,
  riderHistoryKey,
  riderOrdersKey,
  todayStats,
  toCurrentOrder,
  toNearbyOrder,
  useClaimDelivery,
  useRiderHistory,
  useRiderOrders,
  useRiderRating,
} from '@/features/rider/use-rider-live';
import { useAuth } from '@/hooks/useAuth';
import { greetingName } from '@/lib/home-catalog';
import { ensureForegroundLocationPermission } from '@/lib/permissions';

export function RiderHomeScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile, refreshProfile } = useAuth();
  const orders = useRiderOrders();
  const history = useRiderHistory();
  const rating = useRiderRating();
  const claim = useClaimDelivery();
  const tracking = useRiderTracking();
  const [dutyBusy, setDutyBusy] = useState(false);
  const [needsLocation, setNeedsLocation] = useState(false);
  const profileOnline = Boolean(profile?.is_online);
  const [optimisticOnline, setOptimisticOnline] = useState<boolean | null>(null);
  const online = optimisticOnline ?? profileOnline;
  const firstName = greetingName(profile?.full_name, profile?.email);
  const mine = orders.data?.mine ?? [];
  const active = pickActive(mine);
  const nearby = (orders.data?.available ?? []).map(toNearbyOrder);
  const stats = todayStats(history.data ?? [], active, rating.data?.label ?? 'New');

  useEffect(() => {
    setOptimisticOnline(null);
  }, [profileOnline]);

  async function setDuty(next: boolean) {
    if (!profile?.id || dutyBusy || next === online) return;

    if (!next && active) {
      Alert.alert(
        'Finish this delivery first',
        'You cannot go off duty while an order is assigned. Deliver or wait until it is cancelled.',
      );
      return;
    }

    if (next) {
      const permission = await ensureForegroundLocationPermission();
      if (permission !== 'granted') {
        setNeedsLocation(true);
        Alert.alert('Location required', 'Allow location access before starting duty.');
        return;
      }
      setNeedsLocation(false);
    }

    setDutyBusy(true);
    setOptimisticOnline(next);
    try {
      await setRiderDuty(next);
      if (!next) await stopRiderTracking();
      await refreshProfile();
      void queryClient.invalidateQueries({ queryKey: riderOrdersKey });
      void queryClient.invalidateQueries({ queryKey: riderHistoryKey });
    } catch (error) {
      setOptimisticOnline(profileOnline);
      Alert.alert('Could not update duty', userFacingMessage(error));
      await refreshProfile();
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
        {needsLocation || tracking.error ? (
          <LocationPermissionGate
            onRetry={() => {
              setNeedsLocation(false);
              void setDuty(true);
            }}
          />
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
                body="Start duty when you want new delivery requests. Finish any active order before going offline."
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
                      void (async () => {
                        const permission = await ensureForegroundLocationPermission();
                        if (permission !== 'granted') {
                          setNeedsLocation(true);
                          Alert.alert('Location required', 'Allow location before accepting a delivery.');
                          return;
                        }
                        try {
                          await claim.mutateAsync(order.id);
                        } catch (error: unknown) {
                          Alert.alert('Could not accept', userFacingMessage(error));
                        }
                      })();
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
