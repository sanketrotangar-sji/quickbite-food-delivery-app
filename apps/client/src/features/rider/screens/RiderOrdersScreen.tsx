import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { LogoLoader } from '@/components/LogoLoader';
import { Screen } from '@/components/Screen';
import { colors, formatInr, radii, tabBarInset } from '@/constants/theme';
import { deliveryStatusLabel, useDeliveryStep } from '@/features/rider/delivery-session';
import { pickActive, toCurrentOrder, useRiderOrders } from '@/features/rider/use-rider-live';
import type { RiderDelivery } from '@/api/deliveries';

type Segment = 'active' | 'past';

export function RiderOrdersScreen() {
  const orders = useRiderOrders();
  const [segment, setSegment] = useState<Segment>('active');
  const activeDelivery = pickActive(orders.data?.mine ?? []);
  const step = useDeliveryStep(activeDelivery?.id ?? null, activeDelivery?.status);
  const active = activeDelivery ? [toCurrentOrder(activeDelivery)] : [];
  const past = (orders.data?.history ?? []).filter((order) => order.status === 'delivered');
  const visible = segment === 'active' ? active : past;

  if (orders.isLoading && !orders.data) {
    return (
      <Screen>
        <LogoLoader />
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppText heading weight="semibold" style={styles.title}>
          Orders
        </AppText>
        <View style={styles.segment}>
          {(
            [
              ['active', 'Active'],
              ['past', 'Completed'],
            ] as const
          ).map(([id, label]) => {
            const on = id === segment;
            return (
              <Pressable key={id} onPress={() => setSegment(id)} style={[styles.segmentItem, on && styles.segmentOn]}>
                <AppText weight="semibold" style={[styles.segmentLabel, on && styles.segmentLabelOn]}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {orders.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load deliveries"
            body="Deliveries didn't come through. Try again."
            actionLabel="Try again"
            onAction={() => void orders.refetch()}
          />
        ) : null}

        {!orders.isError && visible.length === 0 ? (
          <EmptyState
            icon={segment === 'active' ? 'bicycle-outline' : 'receipt-outline'}
            title={segment === 'active' ? 'No active delivery' : 'No completed deliveries'}
            body={
              segment === 'active'
                ? 'When you accept a request, the trip stays here until you mark it delivered.'
                : 'Finished trips will collect here with the pay for each one.'
            }
          />
        ) : null}

        {!orders.isError && segment === 'active'
          ? active.map((order) => (
              <Pressable
                key={order.id}
                onPress={() => router.push('/(rider)/delivery')}
                style={({ pressed }) => [styles.card, styles.active, pressed && styles.pressed]}>
                <Image source={order.image} style={styles.thumb} />
                <View style={styles.copy}>
                  <AppText weight="bold" numberOfLines={1}>
                    {order.restaurantName}
                  </AppText>
                  <AppText muted numberOfLines={1} style={styles.meta}>
                    {order.cuisine}
                  </AppText>
                  <AppText weight="semibold" style={styles.status}>
                    {deliveryStatusLabel(step)}
                  </AppText>
                  <AppText muted style={styles.meta}>
                    Pickup {order.pickup.distanceKm.toFixed(1)} km · Drop {order.drop.distanceKm.toFixed(1)} km · {order.minutesToPickup} min
                  </AppText>
                </View>
                <View style={styles.side}>
                  <AppText weight="bold">{formatInr(order.earning)}</AppText>
                  <View style={styles.viewRow}>
                    <AppText weight="semibold" style={styles.view}>
                      View Order
                    </AppText>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                </View>
              </Pressable>
            ))
          : null}

        {!orders.isError && segment === 'past'
          ? past.map((order) => (
              <View key={order.id} style={styles.card}>
                <View style={styles.historyTop}>
                  <View style={styles.copy}>
                    <AppText weight="bold" numberOfLines={1}>
                      {order.restaurantName}
                    </AppText>
                    <AppText muted style={styles.meta}>
                      #{order.notes && /^QB\d+$/i.test(order.notes) ? order.notes.toUpperCase() : order.id.replace(/-/g, '').slice(-6).toUpperCase()} ·{' '}
                      {new Date(order.deliveredAt ?? order.placedAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </AppText>
                  </View>
                  <AppText weight="bold">{formatInr(order.earning + order.tip + order.bonus)}</AppText>
                </View>
                <AppText weight="semibold" style={styles.done}>
                  Delivered
                </AppText>
              </View>
            ))
          : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: tabBarInset + 24, gap: 12 },
  title: { fontSize: 22 },
  segment: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  segmentItem: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 13 },
  segmentOn: { backgroundColor: colors.primary },
  segmentLabel: { fontSize: 13, color: colors.textMuted },
  segmentLabelOn: { color: colors.white },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  active: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.72 },
  thumb: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  copy: { flex: 1, gap: 2 },
  side: { alignItems: 'flex-end', gap: 6 },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  view: { color: colors.primary, fontSize: 12 },
  status: { color: colors.primary, fontSize: 12 },
  done: { color: colors.success, fontSize: 12 },
  meta: { fontSize: 12 },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
