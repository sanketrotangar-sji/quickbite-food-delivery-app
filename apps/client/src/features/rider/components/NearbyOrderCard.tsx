import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { RemoteImage } from '@/components/RemoteImage';
import { Sheet } from '@/components/Sheet';
import { colors, formatInr, radii } from '@/constants/theme';
import type { NearbyOrder } from '@/features/rider/rider-home';

export function NearbyOrderCard({ order, onAccept }: { order: NearbyOrder; onAccept: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <RemoteImage
          uri={order.imageUrl}
          fallbackText={order.restaurantName}
          fallbackFontSize={20}
          slot="thumb"
          style={styles.image}
        />
        <View style={styles.copy}>
          <AppText weight="bold" numberOfLines={1}>
            {order.restaurantName}
          </AppText>
          <AppText muted numberOfLines={1} variant="meta">
            {order.cuisine}
          </AppText>
          <View style={styles.distances}>
            <Ionicons name="person" size={12} color={colors.primary} />
            <AppText variant="caption" style={styles.distance}>
              Pickup {order.pickupKm.toFixed(1)} km
            </AppText>
            <Ionicons name="location" size={12} color={colors.success} />
            <AppText variant="caption" style={styles.distance}>
              Drop {order.dropKm.toFixed(1)} km
            </AppText>
          </View>
        </View>
      </Pressable>
      <View style={styles.side}>
        <Pressable onPress={() => setOpen(true)} hitSlop={8} style={styles.priceRow} accessibilityLabel="Order details">
          <AppText weight="bold">{formatInr(order.earning)}</AppText>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </Pressable>
        <Button label="Accept" onPress={onAccept} style={styles.accept} />
      </View>
      <DetailSheet
        order={order}
        visible={open}
        onClose={() => setOpen(false)}
        onAccept={() => {
          setOpen(false);
          onAccept();
        }}
      />
    </View>
  );
}

function DetailSheet({
  order,
  visible,
  onClose,
  onAccept,
}: {
  order: NearbyOrder;
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={order.restaurantName} subtitle={order.cuisine}>
      <AppText>
        Pickup {order.pickupKm.toFixed(1)} km · Drop {order.dropKm.toFixed(1)} km
      </AppText>
      <AppText weight="bold" variant="bodyLg" style={styles.earn}>
        You earn {formatInr(order.earning)}
      </AppText>
      <Button label="Accept" onPress={onAccept} />
      <Button label="Close" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.86 },
  image: { width: 64, height: 64, borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  copy: { flex: 1, gap: 3 },
  distances: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  distance: { color: colors.textMuted, marginRight: 4 },
  side: { alignItems: 'flex-end', gap: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  accept: { minHeight: 32, paddingHorizontal: 12, borderRadius: radii.pill },
  earn: { color: colors.primary },
});
