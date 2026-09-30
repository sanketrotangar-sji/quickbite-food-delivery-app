import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DeliveryCoordinate } from '@/api/deliveries';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { CustomerOrderMap } from '@/components/order/CustomerOrderMap';
import { colors } from '@/constants/theme';
import { useTrackedOrder } from '@/hooks/useOrderTracking';

const TRACK_BG = colors.background;
const TRACK_TEXT = colors.text;

function coordinate(lat: number | null | undefined, lng: number | null | undefined): DeliveryCoordinate | null {
  return lat == null || lng == null ? null : { latitude: lat, longitude: lng };
}

export function OrderFullMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const tracked = useTrackedOrder(id);
  const order = tracked.data;

  if (tracked.isLoading && !order) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LoadingSkeleton variant="feature" rows={1} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <EmptyState
          icon="map-outline"
          title="Map unavailable"
          body={tracked.error instanceof Error ? tracked.error.message : 'This order could not be found.'}
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const restaurant = coordinate(order.restaurant?.lat, order.restaurant?.lng);
  const customer = coordinate(order.delivery_lat, order.delivery_lng);
  const rider = coordinate(order.riderLocation?.lat, order.riderLocation?.lng);
  const live = Boolean(order.rider_id && order.riderLocation && order.status === 'out_for_delivery');

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityLabel="Close full map">
          <Ionicons name="chevron-back" size={22} color={TRACK_TEXT} />
          <AppText weight="semibold" style={styles.closeText}>
            Back
          </AppText>
        </Pressable>
        <AppText heading weight="semibold" style={styles.title}>
          Live map
        </AppText>
        <View style={styles.closeSpacer} />
      </View>
      <View style={styles.mapFill}>
        <CustomerOrderMap
          rider={rider}
          restaurant={restaurant}
          customer={customer}
          height="fill"
          borderRadius={0}
          restaurantLabel={order.restaurant?.name ?? 'Kitchen'}
          customerLabel="Your location"
          showChrome
          live={live}
          hideFullMapButton
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TRACK_BG },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  close: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 72 },
  closeText: { fontSize: 15, color: TRACK_TEXT },
  closeSpacer: { minWidth: 72 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, color: TRACK_TEXT },
  mapFill: { flex: 1 },
});
