import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { OrderCard } from '@/components/OrderCard';
import { Screen } from '@/components/Screen';
import { ACTIVE_ORDER_BAR_HEIGHT } from '@/components/home/CustomerTabBar';
import { type OrderStatus } from '@/constants/orderStatus';
import { colors, formatInr, tabBarInset } from '@/constants/theme';
import { useCart } from '@/hooks/useCart';
import { useCartReplacePrompt } from '@/hooks/useCartReplacePrompt';
import { useOrders } from '@/hooks/useOrders';
import type { CustomerOrder } from '@/types/models';

type Segment = 'active' | 'past';

const ACTIVE: OrderStatus[] = ['placed', 'preparing', 'ready', 'out_for_delivery'];

export function OrdersScreen() {
  const orders = useOrders();
  const cart = useCart();
  const replace = useCartReplacePrompt();
  const [segment, setSegment] = useState<Segment>('active');
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const rows = orders.data ?? [];
  const active = rows.filter((order) => ACTIVE.includes(order.status));
  const past = rows.filter((order) => !ACTIVE.includes(order.status));
  const visible = segment === 'active' ? active : past;

  async function addLines(order: CustomerOrder) {
    const lines = order.order_items.filter((line) => line.menu_item_id);
    for (const line of lines) {
      const count = Math.max(1, line.quantity);
      for (let index = 0; index < count; index += 1) {
        await cart.addItem.mutateAsync({
          menuItemId: line.menu_item_id as string,
          restaurantId: order.restaurant_id,
        });
      }
    }
  }

  function reorder(order: CustomerOrder) {
    const lines = order.order_items.filter((line) => line.menu_item_id);
    if (!lines.length) {
      Alert.alert('Cannot reorder', 'Those dishes are no longer linked to the menu.');
      return;
    }
    setReorderingId(order.id);
    void replace
      .runWithReplacePrompt(
        async () => {
          await addLines(order);
          router.push('/(customer)/cart');
        },
        {
          confirmLabel: 'Clear cart & reorder',
          retry: async () => {
            await addLines(order);
            router.push('/(customer)/cart');
          },
        },
      )
      .catch((error: unknown) => {
        Alert.alert('Could not reorder', error instanceof Error ? error.message : 'Try again.');
      })
      .finally(() => setReorderingId(null));
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      {replace.dialog}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, active.length > 0 && { paddingBottom: tabBarInset + ACTIVE_ORDER_BAR_HEIGHT + 24 }]}
        refreshControl={
          <RefreshControl refreshing={orders.isRefetching && !orders.isLoading} onRefresh={() => void orders.refetch()} />
        }>
        <AppText heading weight="semibold" style={styles.title}>
          Your Orders
        </AppText>
        <View style={styles.segment}>
          {(['active', 'past'] as const).map((id) => {
            const on = id === segment;
            const label = id === 'active' ? 'Active' : 'Past';
            return (
              <Pressable key={id} onPress={() => setSegment(id)} style={[styles.segmentItem, on && styles.segmentOn]}>
                <AppText weight="semibold" style={[styles.segmentLabel, on && styles.segmentLabelOn]}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {orders.isLoading ? <LoadingSkeleton rows={2} /> : null}

        {!orders.isLoading && orders.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load orders"
            body={orders.error instanceof Error ? orders.error.message : 'Pull to refresh, or try again.'}
            actionLabel="Try again"
            onAction={() => void orders.refetch()}
          />
        ) : null}

        {!orders.isLoading && !orders.isError && rows.length === 0 ? (
          <EmptyState
            icon="bag-handle-outline"
            title="No orders yet"
            body="When you place an order it shows up here, with live status while it's on the way."
            actionLabel="Browse kitchens"
            onAction={() => router.push('/(customer)/(tabs)')}
          />
        ) : null}

        {!orders.isLoading && !orders.isError && rows.length > 0 && visible.length === 0 ? (
          <EmptyState
            icon={segment === 'active' ? 'bicycle-outline' : 'receipt-outline'}
            title={segment === 'active' ? 'No active orders' : 'No past orders'}
            body={
              segment === 'active'
                ? 'Nothing is on the way right now. Past orders stay in the other tab.'
                : 'Delivered and cancelled orders will collect here.'
            }
          />
        ) : null}

        <View style={styles.list}>
          {visible.map((order, index) => {
            const when = new Date(order.placed_at).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            });
            const summary = order.order_items.map((line) => `${line.quantity}× ${line.item_name}`).join(', ');
            const prominent = segment === 'active' && index === 0;
            return (
              <OrderCard
                key={order.id}
                variant={prominent ? 'active' : 'compact'}
                restaurantName={order.restaurants?.name ?? 'Restaurant'}
                imageUrl={order.restaurants?.image_url}
                orderCode={`#${order.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`}
                itemsSummary={summary || 'Items from this kitchen'}
                amount={formatInr(order.total_amount)}
                status={order.status}
                when={when}
                eta={order.eta_minutes != null && ACTIVE.includes(order.status) ? `${order.eta_minutes} min ETA` : null}
                address={prominent ? order.delivery_address : null}
                onPress={segment === 'active' ? () => router.push(`/(customer)/orders/${order.id}`) : undefined}
                onReorder={segment === 'past' && order.status === 'delivered' ? () => reorder(order) : undefined}
                reordering={reorderingId === order.id}
              />
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: tabBarInset + 24, gap: 14 },
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
  list: { gap: 10 },
});
