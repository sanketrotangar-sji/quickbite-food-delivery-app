import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FlowHeader } from '@/components/FlowHeader';
import { Screen } from '@/components/Screen';
import { colors, formatInr, radii } from '@/constants/theme';
import { LogoLoader } from '@/components/LogoLoader';
import { pickActive, toCurrentOrder, useAdvanceRiderOrder, useRiderOrders } from '@/features/rider/use-rider-live';
import {
  advanceDeliveryStep,
  resetDeliveryStep,
  setDeliveryStep,
  useDeliveryStep,
  type DeliveryStep,
} from '@/features/rider/delivery-session';
import type { RiderCurrentOrder } from '@/features/rider/rider-home';
import { RiderRouteMap } from '@/features/rider/components/RiderRouteMap';
import { useRiderTracking } from '@/features/rider/rider-tracking';

const TRACK = ['Pickup', 'Picked up', 'Drop', 'Delivered'] as const;

type StepContent = {
  title: string;
  progress: number;
  rows: { label: string; value: string }[];
  note?: string;
  cta: string;
  done?: boolean;
};

function contentFor(step: DeliveryStep, order: RiderCurrentOrder): StepContent {
  if (step === 'to_pickup') {
    return {
      title: 'Going to pickup',
      progress: 0,
      rows: [
        { label: 'Restaurant', value: order.restaurantName },
        { label: 'Pickup', value: order.pickup.address },
        { label: 'Distance', value: `${order.pickup.distanceKm.toFixed(1)} km` },
        { label: 'ETA', value: `${order.minutesToPickup} min` },
      ],
      cta: "I've arrived",
    };
  }
  if (step === 'at_pickup') {
    return {
      title: 'At the restaurant',
      progress: 0,
      rows: [
        { label: 'Restaurant', value: order.restaurantName },
        { label: 'Order', value: `#${order.code}` },
        { label: 'Items', value: `${order.itemCount} items` },
        { label: 'Pickup', value: order.pickup.address },
      ],
      note: 'Kitchen says the order is ready',
      cta: 'Confirm pickup',
    };
  }
  if (step === 'picked_up') {
    return {
      title: 'Going to drop',
      progress: 1,
      rows: [
        { label: 'Drop', value: order.drop.address },
        { label: 'Distance', value: `${order.drop.distanceKm.toFixed(1)} km` },
        { label: 'ETA', value: 'about 16 min' },
      ],
      cta: "I've arrived",
    };
  }
  if (step === 'at_customer') {
    return {
      title: 'At customer',
      progress: 2,
      rows: [
        { label: 'Drop', value: order.drop.address },
        { label: 'Order', value: `#${order.code}` },
        { label: 'Items', value: `${order.itemCount} items` },
      ],
      cta: 'Confirm delivery',
    };
  }
  return {
    title: 'Delivered',
    progress: 3,
    rows: [
      { label: 'Restaurant', value: order.restaurantName },
      { label: 'Order', value: `#${order.code}` },
      { label: 'Earning', value: formatInr(order.earning) },
    ],
    cta: 'Back to Orders',
    done: true,
  };
}

export function DeliveryScreen() {
  const insets = useSafeAreaInsets();
  const orders = useRiderOrders();
  const advance = useAdvanceRiderOrder();
  const tracking = useRiderTracking();
  const active = pickActive(orders.data?.mine ?? []);
  const order = active ? toCurrentOrder(active) : null;
  const step = useDeliveryStep(active?.id ?? null, active?.status);

  if (orders.isLoading && !orders.data) {
    return (
      <Screen>
        <LogoLoader />
      </Screen>
    );
  }

  if (!order || !active) {
    return (
      <Screen>
        <FlowHeader title="Delivery" />
        <AppText muted style={styles.missing}>
          No active delivery.
        </AppText>
      </Screen>
    );
  }

  const content = contentFor(step, order);
  const orderId = active.id;
  const orderStatus = active.status;
  const pickupReady = step !== 'at_pickup' || active.status === 'ready';
  const destination = step === 'picked_up' || step === 'at_customer' ? 'customer' : 'restaurant';

  function onPrimary() {
    if (content.done) {
      resetDeliveryStep(orderId);
      router.replace('/(rider)/(tabs)/orders');
      return;
    }
    const action = step === 'at_pickup' ? 'start' : step === 'at_customer' ? 'deliver' : null;
    if (!action) {
      advanceDeliveryStep(orderId, orderStatus);
      return;
    }
    void advance
      .mutateAsync({ id: orderId, action })
      .then(() => {
        if (action === 'deliver') setDeliveryStep(orderId, 'completed');
        else advanceDeliveryStep(orderId, 'out_for_delivery');
      })
      .catch((error: Error) => Alert.alert('Could not update delivery', error.message));
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <FlowHeader title={content.title} subtitle={`#${order.code}`} />
      {!content.done ? (
        <RiderRouteMap
          rider={tracking.coordinate}
          restaurant={order.pickup.coordinate}
          customer={order.drop.coordinate}
          destination={destination}
        />
      ) : null}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.track}>
          {TRACK.map((label, stepIndex) => {
            const on = stepIndex <= content.progress;
            return (
              <View key={label} style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.dot, on && styles.dotOn]} />
                  {stepIndex < TRACK.length - 1 ? (
                    <View style={[styles.bar, stepIndex < content.progress && styles.barOn]} />
                  ) : null}
                </View>
                <AppText numberOfLines={2} style={[styles.stepLabel, on && styles.stepLabelOn]}>
                  {label}
                </AppText>
              </View>
            );
          })}
        </View>

        {content.done ? (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={42} color={colors.success} />
            <AppText heading weight="bold" style={styles.successTitle}>
              Delivered
            </AppText>
          </View>
        ) : null}

        <View style={styles.card}>
          {content.rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <AppText muted style={styles.rowLabel}>
                {row.label}
              </AppText>
              <AppText weight="semibold" style={styles.rowValue}>
                {row.value}
              </AppText>
            </View>
          ))}
          {content.note ? <AppText style={styles.note}>{content.note}</AppText> : null}
          {!pickupReady ? (
            <AppText style={styles.waiting}>Waiting for the kitchen to mark this order ready.</AppText>
          ) : null}
          {tracking.error ? <AppText style={styles.trackingError}>{tracking.error}</AppText> : null}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {content.done ? null : (
          <Pressable onPress={() => router.push('/(rider)/report')} style={styles.report}>
            <AppText weight="semibold" style={styles.reportText}>
              Report an issue
            </AppText>
          </Pressable>
        )}
        <Button
          label={!pickupReady ? 'Waiting for kitchen' : content.cta}
          onPress={onPrimary}
          loading={advance.isPending}
          disabled={!pickupReady}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 12 },
  missing: { padding: 16 },
  track: { flexDirection: 'row', gap: 4 },
  step: { flex: 1, gap: 4 },
  rail: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.primary },
  bar: { flex: 1, height: 2, backgroundColor: colors.border, marginLeft: 2 },
  barOn: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 11, color: colors.textMuted },
  stepLabelOn: { color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  row: { gap: 2 },
  rowLabel: { fontSize: 12 },
  rowValue: { fontSize: 15 },
  note: { fontSize: 13, lineHeight: 18 },
  waiting: { fontSize: 13, color: colors.primaryDark },
  trackingError: { fontSize: 12, color: colors.danger },
  success: { alignItems: 'center', gap: 6, paddingVertical: 4 },
  successTitle: { fontSize: 22, textAlign: 'center' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
    backgroundColor: colors.background,
  },
  report: { alignItems: 'center', paddingVertical: 4 },
  reportText: { color: colors.primary },
});
