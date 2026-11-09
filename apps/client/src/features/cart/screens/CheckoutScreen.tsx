import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AddressSheet } from '@/features/addresses/components/AddressSheet';
import { AppText } from '@/components/AppText';
import { FlowHeader } from '@/components/FlowHeader';
import { PriceRow } from '@/components/PriceRow';
import { Screen } from '@/components/Screen';
import { StickyAction } from '@/components/StickyAction';
import { TextField } from '@/components/TextField';
import { TripMap } from '@/components/TripMap';
import { colors, formatInr, radii } from '@/constants/theme';
import { useAddresses } from '@/features/addresses/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/features/cart/useCart';
import { useDeliveryRangeGuard } from '@/features/cart/useDeliveryRangeGuard';
import { usePlaceOrder } from '@/features/orders/useOrders';
import { displayNickname, formatDeliveryAddress } from '@/lib/addresses';
import { errorCopy, type ErrorCopy } from '@/lib/error-copy';
import { getPaymentPreference } from '@/lib/payment-preference';

export function CheckoutScreen() {
  const { height } = useWindowDimensions();
  const { profile } = useAuth();
  const cart = useCart();
  const { selected } = useAddresses();
  const { ensureDeliverable, rangeProblem } = useDeliveryRangeGuard('checkout');
  const place = usePlaceOrder();
  const [notes, setNotes] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placeError, setPlaceError] = useState<ErrorCopy | null>(null);
  const paymentMethod = getPaymentPreference();
  const closed = cart.items.some((line) => line.restaurants?.is_open === false);
  const kitchenRow = cart.items[0]?.restaurants;
  const kitchenPin = { lat: kitchenRow?.lat, lng: kitchenRow?.lng, name: cart.restaurantName };
  const rangeWarning =
    selected && cart.restaurantId ? rangeProblem(cart.restaurantId, kitchenPin) : null;
  const canPlace =
    Boolean(selected?.lat != null && selected?.lng != null) && !closed && !rangeWarning && cart.itemCount > 0;
  const mapHeight = Math.round(height * 0.42);
  const kitchen = cart.restaurantName ?? 'Kitchen';
  const door = selected ? displayNickname(selected) : 'Your address';

  async function onPlace() {
    if (!selected || selected.lat == null || selected.lng == null) {
      setSheetOpen(true);
      return;
    }
    if (cart.restaurantId && !ensureDeliverable(cart.restaurantId, kitchenPin)) {
      return;
    }
    setPlaceError(null);
    try {
      const orderId = await place.mutateAsync({
        address: formatDeliveryAddress(selected),
        addressId: selected.id,
        lat: selected.lat,
        lng: selected.lng,
        notes,
      });
      const id = typeof orderId === 'string' ? orderId : String(orderId);
      if (id) {
        router.replace({
          pathname: '/(customer)/orders/[id]/success',
          params: { id, total: String(cart.total) },
        });
      } else {
        router.replace('/(customer)/(tabs)/reorder');
      }
    } catch (error) {
      setPlaceError(errorCopy(error, 'Could not place order'));
    }
  }

  if (!cart.isLoading && cart.itemCount === 0) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <FlowHeader title="Checkout" />
        <View style={styles.empty}>
          <AppText muted>Your cart is empty.</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <FlowHeader title="Checkout" subtitle={cart.restaurantName ?? undefined} />
      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <TripMap from={kitchen} to={door} height={mapHeight} caption="Kitchen to your door" />

        <AppText heading weight="semibold" style={styles.section}>
          Deliver to
        </AppText>
        {selected ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <AppText weight="bold">{displayNickname(selected)}</AppText>
              <Pressable onPress={() => setSheetOpen(true)} hitSlop={8}>
                <AppText weight="semibold" style={styles.link}>
                  Change
                </AppText>
              </Pressable>
            </View>
            <AppText weight="medium">{profile?.full_name?.trim() || 'Add your name in Profile'}</AppText>
            <AppText muted style={styles.meta}>
              {profile?.phone?.trim() || 'No phone on profile'}
            </AppText>
            <AppText style={styles.address}>{selected.line}</AppText>
            <AppText muted style={styles.meta}>
              {selected.area}
              {selected.landmark.trim() ? ` · ${selected.landmark.trim()}` : ''}
            </AppText>
          </View>
        ) : null}
        {selected && rangeWarning ? (
          <View style={styles.warning}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <AppText style={styles.warningText}>{rangeWarning}</AppText>
          </View>
        ) : null}
        {selected ? null : (
          <Pressable onPress={() => setSheetOpen(true)} style={styles.emptyAddress}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText weight="semibold">Add a delivery address</AppText>
              <AppText muted style={styles.meta}>
                Home, work, or another saved place.
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}

        <AppText heading weight="semibold" style={styles.section}>
          Your order
        </AppText>
        <View style={styles.card}>
          <AppText weight="semibold">{cart.restaurantName ?? 'Kitchen'}</AppText>
          {cart.items.map((line) => {
            const price = Number(line.menu_items?.price ?? 0);
            return (
              <View key={line.id} style={styles.orderLine}>
                <AppText muted style={styles.qty}>
                  {line.quantity}×
                </AppText>
                <AppText style={styles.itemName} numberOfLines={1}>
                  {line.menu_items?.name ?? 'Item'}
                </AppText>
                <AppText weight="medium">{formatInr(price * line.quantity)}</AppText>
              </View>
            );
          })}
          <View style={styles.divider} />
          <PriceRow label="Item total" value={formatInr(cart.subtotal)} />
          {cart.discountAmount > 0 ? (
            <PriceRow
              label={`Kitchen offer (${cart.offerPercent}% off)`}
              value={`- ${formatInr(cart.discountAmount)}`}
              tone="success"
            />
          ) : null}
          <PriceRow label="Delivery fee" value={formatInr(cart.deliveryFee)} />
          <PriceRow label="To pay" value={formatInr(cart.total)} strong />
        </View>

        <TextField
          label="Note for the kitchen (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Less spice, extra raita, leave at the door"
        />

        {placeError ? <PlaceFailure error={placeError} onChangeAddress={() => setSheetOpen(true)} /> : null}
        {closed ? (
          <AppText style={styles.block}>This kitchen is closed, so the order stays in your cart.</AppText>
        ) : null}
      </ScrollView>
      <StickyAction
        leading={formatInr(cart.total)}
        label={paymentMethod === 'card' ? 'Place order · pay by card (test)' : 'Place order · cash'}
        loading={place.isPending}
        disabled={!canPlace}
        onPress={() => void onPlace()}
      />
      <AddressSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </Screen>
  );
}


function PlaceFailure({ error, onChangeAddress }: { error: ErrorCopy; onChangeAddress: () => void }) {
  const action =
    error.code === 'DELIVERY_RANGE' || error.code === 'ADDRESS_NOT_FOUND' || error.code === 'ADDRESS_REQUIRED'
      ? { label: 'Change address', onPress: onChangeAddress }
      : error.code === 'ITEM_UNAVAILABLE' || error.code === 'CART_MIXED'
        ? { label: 'Review cart', onPress: () => router.back() }
        : error.code === 'RESTAURANT_CLOSED'
          ? { label: 'Find open kitchens', onPress: () => router.replace('/(customer)/(tabs)') }
          : null;
  return (
    <View style={styles.failure} accessibilityRole="alert">
      <Ionicons name="close-circle" size={20} color={colors.danger} />
      <View style={styles.flex}>
        <AppText weight="bold">{error.title}</AppText>
        <AppText muted style={styles.meta}>
          {error.message}
        </AppText>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8}>
            <AppText weight="semibold" style={styles.link}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.dangerSoft,
  },
  warningText: { flex: 1, fontSize: 13, color: colors.danger },
  failure: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
  },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 16, marginTop: 6 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  link: { color: colors.primary },
  meta: { fontSize: 13, lineHeight: 18 },
  address: { marginTop: 6 },
  emptyAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    padding: 14,
  },
  orderLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  qty: { width: 28 },
  itemName: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  block: { color: colors.primaryDark, fontSize: 13 },
});
