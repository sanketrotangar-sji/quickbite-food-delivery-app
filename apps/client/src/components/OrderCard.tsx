import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { ORDER_STATUS_META, ORDER_STATUS_ORDER, type OrderStatus } from '@/constants/orderStatus';
import { colors, radii } from '@/constants/theme';

export function OrderCard({
  variant,
  restaurantName,
  imageUrl,
  orderCode,
  itemsSummary,
  amount,
  status,
  when,
  eta,
  address,
  onPress,
  onReorder,
  reordering,
}: {
  variant: 'active' | 'compact';
  restaurantName: string;
  imageUrl?: string | null;
  orderCode: string;
  itemsSummary: string;
  amount: string;
  status: OrderStatus;
  when: string;
  eta?: string | null;
  address?: string | null;
  onPress?: () => void;
  onReorder?: () => void;
  reordering?: boolean;
}) {
  const hint = ORDER_STATUS_META[status].customerHint;
  const initial = restaurantName.slice(0, 1).toUpperCase();

  if (variant === 'compact') {
    return (
      <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.top}>
          <Thumb imageUrl={imageUrl} initial={initial} size={44} />
          <View style={styles.copy}>
            <AppText weight="semibold" numberOfLines={1}>
              {restaurantName}
            </AppText>
            <AppText muted numberOfLines={1} style={styles.meta}>
              {orderCode} · {when}
            </AppText>
          </View>
          <OrderStatusBadge status={status} />
        </View>
        <AppText muted numberOfLines={2} style={styles.items}>
          {itemsSummary}
        </AppText>
        <View style={styles.footer}>
          <AppText weight="bold">{amount}</AppText>
          {onReorder ? (
            <Pressable
              onPress={onReorder}
              disabled={reordering}
              style={({ pressed }) => [styles.reorder, pressed && styles.pressed, reordering && styles.pressed]}
              accessibilityRole="button">
              <AppText weight="semibold" style={styles.reorderText}>
                {reordering ? 'Adding…' : 'Reorder'}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    );
  }

  const stepIndex = status === 'cancelled' ? -1 : ORDER_STATUS_ORDER.indexOf(status);

  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <Thumb imageUrl={imageUrl} initial={initial} size={64} />
        <View style={styles.copy}>
          <AppText weight="bold" numberOfLines={1} style={styles.name}>
            {restaurantName}
          </AppText>
          <AppText muted style={styles.meta}>
            {orderCode}
          </AppText>
          <OrderStatusBadge status={status} />
        </View>
      </View>
      <AppText numberOfLines={2}>{itemsSummary}</AppText>
      <View style={styles.metrics}>
        <AppText weight="bold">{amount}</AppText>
        {eta ? (
          <AppText weight="semibold" style={styles.eta}>
            {eta}
          </AppText>
        ) : (
          <AppText muted style={styles.meta}>
            {when}
          </AppText>
        )}
      </View>
      {stepIndex >= 0 ? <StatusTrack index={stepIndex} /> : null}
      <AppText muted style={styles.hint}>
        {hint}
      </AppText>
      {address ? (
        <AppText muted numberOfLines={2} style={styles.meta}>
          {address}
        </AppText>
      ) : null}
      {onReorder ? <Button label={reordering ? 'Adding…' : 'Reorder'} onPress={onReorder} loading={reordering} /> : null}
    </Pressable>
  );
}

function Thumb({ imageUrl, initial, size }: { imageUrl?: string | null; initial: string; size: number }) {
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={[styles.thumb, { width: size, height: size }]} />;
  }
  return (
    <View style={[styles.thumb, styles.fallback, { width: size, height: size }]}>
      <AppText weight="bold" style={styles.fallbackText}>
        {initial}
      </AppText>
    </View>
  );
}

function StatusTrack({ index }: { index: number }) {
  return (
    <View style={styles.track}>
      {ORDER_STATUS_ORDER.map((step, stepIndex) => {
        const on = stepIndex <= index;
        const current = stepIndex === index;
        return (
          <View key={step} style={styles.step}>
            <View style={styles.stepRail}>
              <View style={[styles.dot, on && styles.dotOn, current && styles.dotCurrent]} />
              {stepIndex < ORDER_STATUS_ORDER.length - 1 ? <View style={[styles.bar, stepIndex < index && styles.barOn]} /> : null}
            </View>
            <AppText numberOfLines={2} style={[styles.stepLabel, on && styles.stepLabelOn]}>
              {ORDER_STATUS_META[step].label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 2 },
  name: { fontSize: 16 },
  meta: { fontSize: 12 },
  items: { fontSize: 13, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reorder: {
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reorderText: { color: colors.white, fontSize: 13 },
  pressed: { opacity: 0.72 },
  metrics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eta: { color: colors.primary, fontSize: 13 },
  hint: { fontSize: 13, lineHeight: 18 },
  thumb: { borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: colors.primary, fontSize: 16 },
  track: { flexDirection: 'row', gap: 2, marginTop: 4 },
  step: { flex: 1, gap: 4 },
  stepRail: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotOn: { backgroundColor: colors.primary },
  dotCurrent: { width: 10, height: 10, borderRadius: 5 },
  bar: { flex: 1, height: 2, backgroundColor: colors.border, marginLeft: 2 },
  barOn: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 9, lineHeight: 12, color: colors.textMuted },
  stepLabelOn: { color: colors.text },
});
