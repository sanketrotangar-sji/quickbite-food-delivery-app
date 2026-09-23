import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DeliveryCoordinate } from '@/api/deliveries';
import type { TrackedOrder } from '@/api/order-tracking';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { LogoLoader } from '@/components/LogoLoader';
import { CustomerOrderMap } from '@/components/order/CustomerOrderMap';
import { ORDER_STATUS_META, ORDER_STATUS_ORDER, type OrderStatus } from '@/constants/orderStatus';
import { colors, formatInr, radii } from '@/constants/theme';
import { useTrackedOrder } from '@/hooks/useOrderTracking';

export function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const tracked = useTrackedOrder(id);
  const order = tracked.data;

  if (tracked.isLoading && !order) {
    return <View style={[styles.root, { paddingTop: insets.top }]}><LogoLoader /></View>;
  }

  if (!order) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <Header />
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

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={tracked.isRefetching} onRefresh={() => void tracked.refetch()} />}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 14) + 24 }}>
        <View style={{ paddingTop: insets.top + 6 }}><Header /></View>
        <CustomerOrderMap rider={rider} restaurant={restaurant} customer={customer} />
        <View style={styles.content}>
          <StatusHero order={order} />
          <RiderCard order={order} />
          <StatusHistory order={order} />
          <InfoCard icon="location-outline" title="Delivery address">
            <AppText style={styles.body}>{order.delivery_address}</AppText>
            {order.notes ? <AppText muted style={styles.note}>Note: {order.notes}</AppText> : null}
          </InfoCard>
          <OrderSummary order={order} />
          <SupportAction phone={order.restaurant?.phone ?? order.rider?.phone ?? null} />
        </View>
      </ScrollView>
    </View>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <AppText heading weight="semibold" style={styles.headerTitle}>Track order</AppText>
      <Pressable onPress={() => router.replace('/(customer)/(tabs)/reorder')} style={styles.headerButton} accessibilityLabel="All orders">
        <Ionicons name="receipt-outline" size={21} color={colors.text} />
      </Pressable>
    </View>
  );
}

function StatusHero({ order }: { order: TrackedOrder }) {
  const meta = ORDER_STATUS_META[order.status];
  const code = order.id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return (
    <View style={[styles.hero, { backgroundColor: meta.background }]}>
      <View style={styles.heroTop}>
        <View style={styles.heroCopy}>
          <AppText muted style={styles.eyebrow}>ORDER #{code}</AppText>
          <AppText heading weight="bold" style={styles.heroTitle}>{meta.label}</AppText>
          <AppText style={styles.heroHint}>{meta.customerHint}</AppText>
        </View>
        <View style={[styles.statusIcon, { backgroundColor: meta.color }]}>
          <Ionicons name={statusIcon(order.status)} size={24} color={colors.white} />
        </View>
      </View>
      {order.eta_minutes != null && order.status !== 'delivered' && order.status !== 'cancelled' ? (
        <View style={styles.eta}>
          <Ionicons name="time-outline" size={19} color={meta.color} />
          <AppText weight="bold" style={{ color: meta.color }}>{order.eta_minutes} min ETA</AppText>
        </View>
      ) : null}
    </View>
  );
}

function RiderCard({ order }: { order: TrackedOrder }) {
  if (!order.rider_id) {
    return (
      <InfoCard icon="bicycle-outline" title="Finding your rider">
        <AppText muted style={styles.body}>A delivery partner will be assigned as your food gets ready.</AppText>
      </InfoCard>
    );
  }
  const rider = order.rider;
  return (
    <InfoCard icon="bicycle" title={rider?.full_name || 'Your delivery partner'}>
      <View style={styles.detailRow}>
        <AppText muted style={styles.body}>
          {[rider?.vehicle_label, rider?.plate].filter(Boolean).join(' · ') || 'Rider assigned'}
        </AppText>
        {order.riderLocation ? <View style={styles.liveBadge}><View style={styles.liveDot} /><AppText weight="semibold" style={styles.liveText}>Live</AppText></View> : null}
      </View>
      {rider?.phone ? (
        <Pressable onPress={() => void Linking.openURL(`tel:${rider.phone}`)} style={styles.inlineAction}>
          <Ionicons name="call-outline" size={16} color={colors.primary} />
          <AppText weight="semibold" style={styles.actionText}>Call rider</AppText>
        </Pressable>
      ) : null}
    </InfoCard>
  );
}

function StatusHistory({ order }: { order: TrackedOrder }) {
  const history = order.history.length
    ? order.history
    : [{ id: 0, status: order.status, changed_at: order.updated_at }];
  return (
    <InfoCard icon="list-outline" title="Order updates">
      <View style={styles.timeline}>
        {history.map((entry, index) => {
          const complete = entry.status !== 'cancelled';
          return (
            <View key={entry.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, complete && styles.timelineDotOn]} />
                {index < history.length - 1 ? <View style={[styles.timelineLine, complete && styles.timelineLineOn]} /> : null}
              </View>
              <View style={styles.timelineCopy}>
                <AppText weight="semibold">{ORDER_STATUS_META[entry.status].label}</AppText>
                <AppText muted style={styles.note}>{formatTime(entry.changed_at)}</AppText>
              </View>
            </View>
          );
        })}
      </View>
    </InfoCard>
  );
}

function OrderSummary({ order }: { order: TrackedOrder }) {
  const itemSubtotal = order.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  return (
    <InfoCard icon="receipt-outline" title={order.restaurant?.name ?? 'Order summary'}>
      <View style={styles.items}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.summaryRow}>
            <AppText style={styles.summaryName}>{item.quantity}× {item.item_name}</AppText>
            <AppText weight="semibold">{formatInr(item.unit_price * item.quantity)}</AppText>
          </View>
        ))}
      </View>
      <View style={styles.divider} />
      <MoneyRow label="Item subtotal" value={itemSubtotal} />
      <MoneyRow label="Delivery fee" value={order.delivery_fee} />
      {order.tip_amount > 0 ? <MoneyRow label="Rider tip" value={order.tip_amount} /> : null}
      <View style={styles.totalRow}>
        <AppText weight="bold">Paid total</AppText>
        <AppText weight="bold">{formatInr(order.total_amount)}</AppText>
      </View>
    </InfoCard>
  );
}

function MoneyRow({ label, value }: { label: string; value: number }) {
  return <View style={styles.summaryRow}><AppText muted>{label}</AppText><AppText>{formatInr(value)}</AppText></View>;
}

function SupportAction({ phone }: { phone: string | null }) {
  const contact = () => {
    if (phone) {
      void Linking.openURL(`tel:${phone}`);
      return;
    }
    Alert.alert('QuickBite support', 'Support contact details are not available yet. Please try again shortly.');
  };
  return <Button label="Get help with this order" variant="ghost" onPress={contact} />;
}

function InfoCard({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTitle}>
        <View style={styles.smallIcon}><Ionicons name={icon} size={17} color={colors.primary} /></View>
        <AppText weight="bold" style={styles.cardTitleText}>{title}</AppText>
      </View>
      {children}
    </View>
  );
}

function coordinate(lat: number | null | undefined, lng: number | null | undefined): DeliveryCoordinate | null {
  return lat == null || lng == null ? null : { latitude: lat, longitude: lng };
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function statusIcon(status: OrderStatus): keyof typeof Ionicons.glyphMap {
  if (status === 'placed') return 'receipt-outline';
  if (status === 'preparing') return 'restaurant-outline';
  if (status === 'ready') return 'bag-check-outline';
  if (status === 'out_for_delivery') return 'bicycle';
  if (status === 'delivered') return 'checkmark-circle-outline';
  return 'close-circle-outline';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18 },
  content: { padding: 16, gap: 12 },
  hero: { borderRadius: radii.xl, padding: 18, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 11, letterSpacing: 0.8 },
  heroTitle: { fontSize: 24 },
  heroHint: { fontSize: 14, lineHeight: 20 },
  statusIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  eta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 15, gap: 10 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  smallIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitleText: { flex: 1, fontSize: 15 },
  body: { fontSize: 13, lineHeight: 19 },
  note: { fontSize: 11 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.successSoft, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 10 },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  actionText: { color: colors.primary, fontSize: 12 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', minHeight: 50 },
  timelineRail: { width: 22, alignItems: 'center' },
  timelineDot: { width: 11, height: 11, borderRadius: 6, marginTop: 4, backgroundColor: colors.border },
  timelineDotOn: { backgroundColor: colors.primary },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 3 },
  timelineLineOn: { backgroundColor: colors.primarySoft },
  timelineCopy: { flex: 1, paddingBottom: 12, gap: 2 },
  items: { gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryName: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 },
});
