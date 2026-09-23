import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AddressSheet } from '@/components/address/AddressSheet';
import { AppText } from '@/components/AppText';
import { FlowHeader } from '@/components/FlowHeader';
import { Screen } from '@/components/Screen';
import { StickyAction } from '@/components/StickyAction';
import { TextField } from '@/components/TextField';
import { TripMap } from '@/components/TripMap';
import { colors, formatInr, radii } from '@/constants/theme';
import { useAddresses } from '@/hooks/useAddresses';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { usePlaceOrder } from '@/hooks/useOrders';
import { displayNickname, formatDeliveryAddress } from '@/lib/addresses';

export function CheckoutScreen() {
  const { height } = useWindowDimensions();
  const { profile } = useAuth();
  const cart = useCart();
  const { selected } = useAddresses();
  const place = usePlaceOrder();
  const [notes, setNotes] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const closed = cart.items.some((line) => line.restaurants?.is_open === false);
  const canPlace = Boolean(selected) && !closed && cart.itemCount > 0;
  const mapHeight = Math.round(height * 0.42);
  const kitchen = cart.restaurantName ?? 'Kitchen';
  const door = selected ? displayNickname(selected) : 'Your address';

  async function onPlace() {
    if (!selected) {
      setSheetOpen(true);
      return;
    }
    setPlaceError('');
    try {
      await place.mutateAsync({
        address: formatDeliveryAddress(selected),
        addressId: selected.id,
        lat: selected.lat,
        lng: selected.lng,
        notes,
      });
      router.replace('/(customer)/(tabs)/reorder');
    } catch (error) {
      setPlaceError(error instanceof Error ? error.message : 'Try again.');
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
        ) : (
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
          <View style={styles.orderLine}>
            <AppText muted style={{ flex: 1 }}>
              Item total
            </AppText>
            <AppText muted>{formatInr(cart.subtotal)}</AppText>
          </View>
          <View style={styles.orderLine}>
            <AppText muted style={{ flex: 1 }}>
              Delivery fee
            </AppText>
            <AppText muted>{formatInr(cart.deliveryFee)}</AppText>
          </View>
          <View style={styles.orderLine}>
            <AppText weight="bold" style={{ flex: 1 }}>
              To pay
            </AppText>
            <AppText weight="bold">{formatInr(cart.total)}</AppText>
          </View>
        </View>

        <TextField
          label="Note for the kitchen (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Less spice, extra raita, leave at the door"
        />

        {placeError ? <AppText style={styles.block}>{placeError}</AppText> : null}
        {closed ? (
          <AppText style={styles.block}>This kitchen is closed, so the order stays in your cart.</AppText>
        ) : null}
      </ScrollView>
      <StickyAction
        leading={formatInr(cart.total)}
        label="Pay via cash"
        loading={place.isPending}
        disabled={!canPlace}
        onPress={() => void onPlace()}
      />
      <AddressSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
