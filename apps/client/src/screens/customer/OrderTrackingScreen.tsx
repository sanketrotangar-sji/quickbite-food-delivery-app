import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DeliveryCoordinate } from '@/api/deliveries';
import type { TrackedOrder } from '@/api/order-tracking';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { HomeHero } from '@/components/home/HomeHero';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ROUTE_ORANGE } from '@/components/maps/quickbite-map-style';
import { CustomerOrderMap } from '@/components/order/CustomerOrderMap';
import { RemoteImage } from '@/components/RemoteImage';
import { VegMark } from '@/components/VegMark';
import { ORDER_STATUS_META, ORDER_STATUS_ORDER, type OrderStatus } from '@/constants/orderStatus';
import { colors, formatInr, radii } from '@/constants/theme';
import { useTrackedOrder } from '@/hooks/useOrderTracking';
import { useMyNotifications } from '@/hooks/useMyNotifications';
import { distanceKm, formatKm } from '@/lib/geo';

const TRACK_BG = colors.background;
const TRACK_TEXT = colors.text;
const TRACK_MUTED = colors.textMuted;
const PAGE_PAD = 16;
const MAP_RADIUS = 20;

const STEP_ICONS: Record<OrderStatus, keyof typeof Ionicons.glyphMap> = {
  placed: 'receipt-outline',
  preparing: 'restaurant-outline',
  ready: 'bag-check-outline',
  out_for_delivery: 'bicycle',
  delivered: 'home-outline',
  cancelled: 'close-circle-outline',
};

export function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const tracked = useTrackedOrder(id);
  const notices = useMyNotifications();
  const order = tracked.data;
  const automationBanner = (notices.data ?? []).find(
    (n) =>
      !n.readAt &&
      (n.title.includes('Rider assigned') ||
        n.title.includes('ETA updated') ||
        n.title.includes('Kitchen is busy')),
  );

  if (tracked.isLoading && !order) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <HomeHero />
        <View style={styles.loading}>
          <LoadingSkeleton variant="feature" rows={1} />
          <LoadingSkeleton rows={2} />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <HomeHero />
        <EmptyState
          icon="receipt-outline"
          title="Order unavailable"
          body={tracked.error instanceof Error ? tracked.error.message : 'This order could not be found.'}
          actionLabel="Back to orders"
          onAction={() => router.replace('/(customer)/(tabs)/reorder')}
        />
      </View>
    );
  }

  const restaurant = coordinate(order.restaurant?.lat, order.restaurant?.lng);
  const customer = coordinate(order.delivery_lat, order.delivery_lng);
  const rider = coordinate(order.riderLocation?.lat, order.riderLocation?.lng);
  const live = Boolean(order.rider_id && order.riderLocation && order.status === 'out_for_delivery');
  const code = orderCode(order.id);
  const placedAt = formatClock(order.placed_at);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={tracked.isRefetching} onRefresh={() => void tracked.refetch()} />
        }
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 28 }}>
        <HomeHero />

        <View style={styles.pageTitle}>
          <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={TRACK_TEXT} />
          </Pressable>
          <View style={styles.pageTitleCopy}>
            <AppText heading weight="bold" style={styles.title}>
              Track Your Order
            </AppText>
            <AppText style={styles.subtitle}>Good food is on the way ❤️</AppText>
          </View>
        </View>

        <View style={styles.content}>
          {automationBanner ? (
            <View style={styles.automationBanner}>
              <AppText weight="semibold" style={styles.automationTitle}>
                {automationBanner.title}
              </AppText>
              <AppText style={styles.automationBody}>{automationBanner.body}</AppText>
            </View>
          ) : null}

          <View style={styles.mapHero}>
            <CustomerOrderMap
              rider={rider}
              restaurant={restaurant}
              customer={customer}
              height={280}
              borderRadius={MAP_RADIUS}
              restaurantLabel={order.restaurant?.name ?? 'Kitchen'}
              customerLabel="Your location"
              showChrome
              live={live}
              onViewFullMap={() => router.push(`/(customer)/orders/${order.id}/map`)}
            />
          </View>

          <OrderProgressCard
            code={code}
            placedAt={placedAt}
            itemCount={itemCount}
            total={Number(order.total_amount)}
            status={order.status}
            history={order.history}
          />

          <RiderSection order={order} riderCoord={rider} customerCoord={customer} />

          <OrderItemsCard order={order} />

          <Pressable
            onPress={() => router.push('/(customer)/(tabs)/assistant')}
            style={({ pressed }) => [styles.support, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Get help with this order">
            <View style={styles.supportIcon}>
              <Ionicons name="headset-outline" size={18} color={ROUTE_ORANGE} />
            </View>
            <View style={styles.supportCopy}>
              <AppText weight="semibold" style={styles.supportTitle}>
                Need help with your order?
              </AppText>
              <AppText style={styles.supportBody}>Chat with RIO or get in touch with support</AppText>
            </View>
            <Ionicons name="arrow-forward" size={16} color={TRACK_MUTED} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function OrderProgressCard({
  code,
  placedAt,
  itemCount,
  total,
  status,
  history,
}: {
  code: string;
  placedAt: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  history: TrackedOrder['history'];
}) {
  const steps = ORDER_STATUS_ORDER;
  const activeIndex = status === 'cancelled' ? -1 : Math.max(0, steps.indexOf(status));
  const timeFor = (step: OrderStatus) => {
    const hit = history.find((row) => row.status === step);
    return hit ? formatClock(hit.changed_at) : null;
  };

  return (
    <View style={styles.card}>
      <AppText weight="bold" style={styles.orderCode}>
        Order #{code}
      </AppText>
      <AppText style={styles.orderMeta}>
        Placed at {placedAt} · {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatInr(total)}
      </AppText>
      {status === 'cancelled' ? (
        <AppText style={styles.cancelledHint}>{ORDER_STATUS_META.cancelled.customerHint}</AppText>
      ) : (
        <View style={styles.stepper}>
          {steps.map((step, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;
            const time = timeFor(step);
            return (
              <View key={step} style={styles.step}>
                <View style={styles.stepRail}>
                  <View style={[styles.stepDot, (done || active) && styles.stepDotOn, active && styles.stepDotActive]}>
                    <Ionicons
                      name={done ? 'checkmark' : STEP_ICONS[step]}
                      size={active ? 14 : 11}
                      color={done || active ? colors.white : TRACK_MUTED}
                    />
                  </View>
                  {index < steps.length - 1 ? (
                    <View style={[styles.stepLine, index < activeIndex && styles.stepLineOn]} />
                  ) : null}
                </View>
                <AppText
                  weight={active ? 'semibold' : 'medium'}
                  numberOfLines={2}
                  style={[styles.stepLabel, (done || active) && styles.stepLabelOn]}>
                  {ORDER_STATUS_META[step].label}
                </AppText>
                {time ? <AppText style={styles.stepTime}>{time}</AppText> : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function RiderSection({
  order,
  riderCoord,
  customerCoord,
}: {
  order: TrackedOrder;
  riderCoord: DeliveryCoordinate | null;
  customerCoord: DeliveryCoordinate | null;
}) {
  if (!order.rider_id) {
    return (
      <View style={styles.card}>
        <AppText weight="bold" style={styles.sectionTitle}>
          Finding your rider
        </AppText>
        <AppText style={styles.bodyMuted}>
          A delivery partner will be assigned as your food gets ready.
        </AppText>
      </View>
    );
  }

  const rider = order.rider;
  const name = rider?.full_name?.trim() || 'Your delivery partner';
  const initial = name.slice(0, 1).toUpperCase();
  const km =
    riderCoord && customerCoord
      ? distanceKm(riderCoord, customerCoord)
      : order.drop_km != null
        ? Number(order.drop_km)
        : null;
  const eta = order.eta_minutes;
  const onWay = order.status === 'out_for_delivery';

  return (
    <View style={styles.card}>
      <View style={styles.riderTop}>
        <View style={styles.riderAvatar}>
          <AppText weight="bold" style={styles.riderInitial}>
            {initial}
          </AppText>
        </View>
        <View style={styles.riderCopy}>
          <AppText weight="bold" style={styles.riderName}>
            {name}
          </AppText>
          <AppText style={styles.bodyMuted}>Your delivery partner</AppText>
          {rider?.vehicle_label || rider?.plate ? (
            <AppText style={styles.riderMeta}>
              {[rider.vehicle_label, rider.plate].filter(Boolean).join(' · ')}
            </AppText>
          ) : null}
        </View>
        {rider?.phone ? (
          <Pressable
            onPress={() => void Linking.openURL(`tel:${rider.phone}`)}
            style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
            accessibilityLabel="Call rider">
            <Ionicons name="call" size={15} color={colors.white} />
            <AppText weight="bold" style={styles.callText}>
              Call
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {(eta != null && order.status !== 'delivered' && order.status !== 'cancelled') || km != null ? (
        <View style={styles.etaStrip}>
          {eta != null && order.status !== 'delivered' && order.status !== 'cancelled' ? (
            <View style={styles.etaItem}>
              <Ionicons name="bicycle" size={16} color={ROUTE_ORANGE} />
              <AppText weight="semibold" style={styles.etaText}>
                Arriving in {eta} mins
              </AppText>
            </View>
          ) : null}
          {km != null ? (
            <View style={styles.etaItem}>
              <Ionicons name="location-outline" size={15} color={ROUTE_ORANGE} />
              <AppText weight="semibold" style={styles.etaText}>
                {formatKm(km)}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}

      <AppText style={styles.riderHint}>
        {onWay
          ? 'Rider is on the way to your location'
          : order.status === 'delivered'
            ? 'Delivered — enjoy your meal'
            : ORDER_STATUS_META[order.status].customerHint}
      </AppText>
    </View>
  );
}

function OrderItemsCard({ order }: { order: TrackedOrder }) {
  return (
    <View style={styles.card}>
      <AppText weight="bold" style={styles.sectionTitle}>
        Order Items
      </AppText>
      <View style={styles.itemList}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            {item.image_url ? (
              <RemoteImage uri={item.image_url} slot="thumb" style={styles.itemImage} />
            ) : (
              <View style={[styles.itemImage, styles.itemFallback]}>
                <AppText weight="bold" style={styles.itemFallbackText}>
                  {item.item_name.slice(0, 1).toUpperCase()}
                </AppText>
              </View>
            )}
            <View style={styles.itemCopy}>
              <View style={styles.itemNameRow}>
                {item.is_veg != null ? <VegMark veg={item.is_veg} size={10} /> : null}
                <AppText weight="semibold" numberOfLines={1} style={styles.itemName}>
                  {item.item_name}
                </AppText>
              </View>
              <AppText style={styles.itemMeta} numberOfLines={1}>
                {order.restaurant?.name ?? 'Kitchen'}
                {item.is_veg != null ? ` · ${item.is_veg ? 'Pure Veg' : 'Non Veg'}` : ''}
              </AppText>
              <AppText style={styles.itemQty}>{item.quantity}×</AppText>
            </View>
            <AppText weight="semibold" style={styles.itemPrice}>
              {formatInr(item.unit_price * item.quantity)}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.eco}>
        <Ionicons name="leaf-outline" size={14} color={colors.success} />
        <AppText style={styles.ecoText}>Eco-friendly delivery — Less carbon. A greener tomorrow.</AppText>
      </View>
    </View>
  );
}

function coordinate(lat: number | null | undefined, lng: number | null | undefined): DeliveryCoordinate | null {
  return lat == null || lng == null ? null : { latitude: lat, longitude: lng };
}

function orderCode(id: string) {
  return `QB${id.replace(/-/g, '').slice(0, 5).toUpperCase()}`;
}

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TRACK_BG },
  loading: { paddingHorizontal: PAGE_PAD, paddingTop: 8, gap: 12 },
  pageTitle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingHorizontal: PAGE_PAD - 4,
    paddingBottom: 10,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  pageTitleCopy: { flex: 1, gap: 2 },
  title: { fontSize: 22, color: TRACK_TEXT },
  subtitle: { fontSize: 13, color: TRACK_MUTED },
  content: { paddingHorizontal: PAGE_PAD, gap: 12 },
  automationBanner: {
    backgroundColor: '#FFF3ED',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#FDBA74',
    padding: 12,
    gap: 4,
  },
  automationTitle: { color: ROUTE_ORANGE, fontSize: 14 },
  automationBody: { fontSize: 13, lineHeight: 18, color: TRACK_MUTED },
  mapHero: {
    borderRadius: MAP_RADIUS,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  orderCode: { fontSize: 17, color: TRACK_TEXT },
  orderMeta: { fontSize: 12, color: TRACK_MUTED },
  cancelledHint: { fontSize: 13, color: TRACK_MUTED, marginTop: 4 },
  stepper: { flexDirection: 'row', marginTop: 8, gap: 0 },
  step: { flex: 1, gap: 4 },
  stepRail: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEEEEE',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  stepDotOn: { backgroundColor: ROUTE_ORANGE, borderColor: ROUTE_ORANGE },
  stepDotActive: { width: 28, height: 28, borderRadius: 14 },
  stepLine: { flex: 1, height: 3, backgroundColor: '#E8E8E8', marginHorizontal: 2, borderRadius: 2 },
  stepLineOn: { backgroundColor: ROUTE_ORANGE },
  stepLabel: { fontSize: 10, color: TRACK_MUTED, lineHeight: 13 },
  stepLabelOn: { color: TRACK_TEXT },
  stepTime: { fontSize: 9, color: TRACK_MUTED },
  sectionTitle: { fontSize: 16, color: TRACK_TEXT },
  bodyMuted: { fontSize: 13, lineHeight: 18, color: TRACK_MUTED },
  riderTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE8DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderInitial: { color: ROUTE_ORANGE, fontSize: 18 },
  riderCopy: { flex: 1, gap: 1 },
  riderName: { fontSize: 15, color: TRACK_TEXT },
  riderMeta: { fontSize: 11, color: TRACK_MUTED, marginTop: 2 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ROUTE_ORANGE,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  callText: { color: colors.white, fontSize: 13 },
  etaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    backgroundColor: '#FFF4EE',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  etaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  etaText: { fontSize: 13, color: TRACK_TEXT },
  riderHint: { fontSize: 12, color: TRACK_MUTED },
  itemList: { gap: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemImage: { width: 52, height: 52, borderRadius: radii.sm, backgroundColor: '#FFE8DC' },
  itemFallback: { alignItems: 'center', justifyContent: 'center' },
  itemFallbackText: { color: ROUTE_ORANGE, fontSize: 16 },
  itemCopy: { flex: 1, gap: 2 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  itemName: { flex: 1, fontSize: 14, color: TRACK_TEXT },
  itemMeta: { fontSize: 11, color: TRACK_MUTED },
  itemQty: { fontSize: 11, color: TRACK_MUTED },
  itemPrice: { fontSize: 13, color: TRACK_TEXT },
  eco: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ecoText: { flex: 1, fontSize: 11, color: colors.success, lineHeight: 15 },
  support: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  supportIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE8DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCopy: { flex: 1, gap: 2 },
  supportTitle: { fontSize: 14, color: TRACK_TEXT },
  supportBody: { fontSize: 12, color: TRACK_MUTED },
  pressed: { opacity: 0.8 },
});
