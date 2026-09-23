import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { colors, radii } from '@/constants/theme';
import type { RiderCurrentOrder } from '@/features/rider/rider-home';

export function CurrentOrderCard({ order }: { order: RiderCurrentOrder }) {
  return (
    <View style={styles.card}>
      <View>
        <Image source={order.image} style={styles.photo} />
        <View style={styles.badge}>
          <AppText weight="bold" style={styles.badgeText}>
            {order.minutesToPickup} min to pickup
          </AppText>
        </View>
      </View>
      <View style={styles.body}>
        <AppText weight="semibold" style={styles.kicker}>
          Current order · #{order.code}
        </AppText>
        <AppText weight="bold" style={styles.name}>
          {order.restaurantName}
        </AppText>
        <AppText muted style={styles.meta}>
          {order.cuisine}
        </AppText>
        <View style={styles.route}>
          <Stop label="Pickup" address={order.pickup.address} distance={`${order.pickup.distanceKm.toFixed(1)} km`} />
          <View style={styles.connector} />
          <Stop label="Drop" address={order.drop.address} distance={`${order.drop.distanceKm.toFixed(1)} km`} />
        </View>
        <Button label="Continue delivery" onPress={() => router.push('/(rider)/delivery')} />
      </View>
    </View>
  );
}

function Stop({ label, address, distance }: { label: string; address: string; distance: string }) {
  return (
    <View style={styles.stop}>
      <View style={styles.stopCopy}>
        <AppText weight="semibold" style={styles.stopLabel}>
          {label}
        </AppText>
        <AppText numberOfLines={2} style={styles.address}>
          {address}
        </AppText>
      </View>
      <AppText muted style={styles.distance}>
        {distance}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: 132, backgroundColor: colors.primarySoft },
  badge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: colors.primary, fontSize: 12 },
  body: { padding: 14, gap: 6 },
  kicker: { color: colors.textMuted, fontSize: 12 },
  name: { fontSize: 18 },
  meta: { fontSize: 13 },
  route: { gap: 0, marginTop: 4, marginBottom: 6 },
  stop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stopCopy: { flex: 1, gap: 1 },
  stopLabel: { fontSize: 12, color: colors.secondary },
  address: { fontSize: 13, lineHeight: 18 },
  distance: { fontSize: 12, marginTop: 2 },
  connector: { marginLeft: 2, width: 2, height: 10, backgroundColor: colors.border },
});
