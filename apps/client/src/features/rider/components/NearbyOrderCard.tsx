import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { colors, formatInr, radii } from '@/constants/theme';
import type { NearbyOrder } from '@/features/rider/rider-home';

export function NearbyOrderCard({ order, onAccept }: { order: NearbyOrder; onAccept: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <Image source={order.image} style={styles.image} />
        <View style={styles.copy}>
          <AppText weight="bold" numberOfLines={1}>
            {order.restaurantName}
          </AppText>
          <AppText muted numberOfLines={1} style={styles.meta}>
            {order.cuisine}
          </AppText>
          <View style={styles.distances}>
            <Ionicons name="person" size={12} color={colors.primary} />
            <AppText style={styles.distance}>Pickup {order.pickupKm.toFixed(1)} km</AppText>
            <Ionicons name="location" size={12} color={colors.success} />
            <AppText style={styles.distance}>Drop {order.dropKm.toFixed(1)} km</AppText>
          </View>
        </View>
      </Pressable>
      <View style={styles.side}>
        <Pressable onPress={() => setOpen(true)} style={styles.priceRow} accessibilityLabel="Order details">
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
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close request" />
        <View style={[styles.sheet, { maxHeight: height * 0.7, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <AppText heading weight="semibold" style={styles.sheetTitle}>
            {order.restaurantName}
          </AppText>
          <AppText muted>{order.cuisine}</AppText>
          <AppText>
            Pickup {order.pickupKm.toFixed(1)} km · Drop {order.dropKm.toFixed(1)} km
          </AppText>
          <AppText weight="bold" style={styles.earn}>
            You earn {formatInr(order.earning)}
          </AppText>
          <Button label="Accept" onPress={onAccept} />
          <Button label="Close" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
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
  meta: { fontSize: 12 },
  distances: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  distance: { fontSize: 11, color: colors.textMuted, marginRight: 4 },
  side: { alignItems: 'flex-end', gap: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  accept: { minHeight: 32, paddingHorizontal: 12, borderRadius: radii.pill },
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 18 },
  earn: { color: colors.primary, fontSize: 16 },
});
