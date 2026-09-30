import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DeliveryCoordinate } from '@/api/deliveries';
import { AppText } from '@/components/AppText';
import { ROUTE_ORANGE } from '@/components/maps/quickbite-map-style';
import { colors, radii } from '@/constants/theme';
import { RiderRouteMap } from '@/features/rider/components/RiderRouteMap';
import type { RiderCurrentOrder } from '@/features/rider/rider-home';

const TRACK_TEXT = colors.text;
const TRACK_MUTED = colors.textMuted;

export function CurrentOrderCard({
  order,
  riderCoordinate,
}: {
  order: RiderCurrentOrder;
  riderCoordinate: DeliveryCoordinate | null;
}) {
  const distanceKm = order.statusLabel === 'On the way' ? order.drop.distanceKm : order.pickup.distanceKm;
  const etaMins = order.minutesToPickup;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <AppText weight="semibold" style={styles.badgeText}>
              {order.statusLabel}
            </AppText>
          </View>
          <AppText weight="bold" style={styles.code}>
            #{order.code}
          </AppText>
          <AppText weight="bold" style={styles.restaurant}>
            {order.restaurantName}
          </AppText>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={TRACK_MUTED} />
            <AppText style={styles.meta}>
              {distanceKm.toFixed(1)} km · {etaMins} mins
            </AppText>
          </View>
          {order.customerName || order.customerPhone ? (
            <View style={styles.customer}>
              <View style={styles.customerRow}>
                <Ionicons name="person-outline" size={14} color={TRACK_MUTED} />
                <AppText weight="semibold" style={styles.customerName}>
                  {order.customerName ?? 'Customer'}
                </AppText>
              </View>
              {order.customerPhone ? (
                <View style={styles.customerRow}>
                  <Ionicons name="call-outline" size={13} color={TRACK_MUTED} />
                  <AppText style={styles.phone}>{order.customerPhone}</AppText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={styles.mapWrap}>
          <RiderRouteMap
            rider={riderCoordinate}
            restaurant={order.pickup.coordinate}
            customer={order.drop.coordinate}
            destination="auto"
            height={132}
            borderRadius={radii.lg}
            compact
            restaurantLabel={order.restaurantName}
            customerLabel="Drop"
          />
        </View>
      </View>
      <Pressable
        onPress={() => router.push('/(rider)/delivery')}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="View order details">
        <AppText weight="bold" style={styles.ctaText}>
          View Order Details
        </AppText>
        <Ionicons name="arrow-forward" size={16} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  top: { flexDirection: 'row', gap: 12 },
  copy: { flex: 1, gap: 4, minWidth: 0 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFE8DC',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 2,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ROUTE_ORANGE },
  badgeText: { color: ROUTE_ORANGE, fontSize: 11 },
  code: { fontSize: 20, color: TRACK_TEXT, letterSpacing: -0.3 },
  restaurant: { fontSize: 15, color: TRACK_TEXT },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { fontSize: 12, color: TRACK_MUTED },
  customer: { marginTop: 8, gap: 4 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { fontSize: 13, color: TRACK_TEXT },
  phone: { fontSize: 12, color: TRACK_MUTED },
  mapWrap: {
    width: 132,
    height: 132,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  cta: {
    backgroundColor: ROUTE_ORANGE,
    borderRadius: radii.pill,
    minHeight: 46,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText: { color: colors.white, fontSize: 14 },
});
