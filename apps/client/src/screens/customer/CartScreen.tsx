import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AddressSheet } from '@/components/address/AddressSheet';
import { AppText } from '@/components/AppText';
import { PaymentSheet } from '@/components/PaymentSheet';
import { EmptyState } from '@/components/EmptyState';
import { FlowHeader } from '@/components/FlowHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { PriceRow } from '@/components/PriceRow';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Screen } from '@/components/Screen';
import { StickyAction } from '@/components/StickyAction';
import { VegMark } from '@/components/VegMark';
import { colors, formatInr, radii } from '@/constants/theme';
import { useAddresses } from '@/hooks/useAddresses';
import { useCart } from '@/hooks/useCart';
import { displayNickname } from '@/lib/addresses';

export function CartScreen() {
  const cart = useCart();
  const { selected } = useAddresses();
  const [addressOpen, setAddressOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const closed = cart.items.some((line) => line.restaurants?.is_open === false);

  function changeQuantity(id: string, quantity: number) {
    cart.updateQuantity.mutate(
      { id, quantity },
      {
        onError: (error) => Alert.alert('Could not update', error instanceof Error ? error.message : 'Try again.'),
      },
    );
  }

  if (cart.isLoading && cart.items.length === 0) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <FlowHeader title="Cart" />
        <View style={styles.content}>
          <LoadingSkeleton rows={3} />
        </View>
      </Screen>
    );
  }

  if (!cart.itemCount) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <FlowHeader title="Cart" />
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          body="Add dishes from a kitchen around you. One restaurant per order."
          actionLabel="Browse kitchens"
          onAction={() => router.replace('/(customer)/(tabs)')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <FlowHeader
        title="Cart"
        subtitle={
          closed
            ? `${cart.restaurantName ?? 'Kitchen'} · Closed`
            : `${cart.restaurantName ?? 'One kitchen'} · ${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'}`
        }
      />
      <ScrollView style={styles.flex} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <AppText weight="semibold" style={styles.kitchen}>
            {cart.restaurantName ?? 'Kitchen'}
          </AppText>
          {cart.items.map((line, index) => {
            const price = Number(line.menu_items?.price ?? 0);
            const name = line.menu_items?.name ?? 'Item';
            const imageUrl = line.menu_items?.image_url;
            return (
              <View key={line.id} style={[styles.line, index > 0 && styles.lineBorder]}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.imageFallback]}>
                    <AppText weight="bold" style={styles.fallbackText}>
                      {name.slice(0, 1).toUpperCase()}
                    </AppText>
                  </View>
                )}
                <View style={styles.lineCopy}>
                  <View style={styles.nameRow}>
                    <VegMark veg={Boolean(line.menu_items?.is_veg)} size={12} />
                    <AppText weight="semibold" numberOfLines={2} style={styles.name}>
                      {name}
                    </AppText>
                  </View>
                  <AppText muted style={styles.price}>
                    {formatInr(price)}
                    {line.quantity > 1 ? ` · ${formatInr(price * line.quantity)}` : ''}
                  </AppText>
                </View>
                <QuantityStepper
                  quantity={line.quantity}
                  label={name}
                  onDecrease={() => changeQuantity(line.id, line.quantity - 1)}
                  onIncrease={() => changeQuantity(line.id, line.quantity + 1)}
                />
              </View>
            );
          })}
        </View>

        {cart.restaurantId ? (
          <Pressable
            onPress={() => router.push(`/(customer)/restaurant/${cart.restaurantId}`)}
            style={({ pressed }) => [styles.addMore, pressed && styles.pressed]}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <AppText weight="semibold" style={styles.addMoreText}>
              Add more items
            </AppText>
          </Pressable>
        ) : null}

        <View style={[styles.card, styles.offer]}>
          <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
          <View style={styles.lineCopy}>
            <AppText weight="semibold">Offers</AppText>
            <AppText muted style={styles.price}>
              No coupons on this order. Kitchen offers stay on Explore.
            </AppText>
          </View>
        </View>

        <View style={styles.card}>
          <AppText heading weight="semibold" style={styles.section}>
            Bill details
          </AppText>
          <PriceRow label="Item total" value={formatInr(cart.subtotal)} />
          <PriceRow label="Delivery fee" value={formatInr(cart.deliveryFee)} />
          <View style={styles.divider} />
          <PriceRow label="Grand total" value={formatInr(cart.total)} strong />
          <AppText muted style={styles.note}>
            Cash on delivery. This is the amount checkout will charge.
          </AppText>
        </View>

        <Pressable
          onPress={() => setAddressOpen(true)}
          style={({ pressed }) => [styles.card, styles.offer, pressed && styles.pressed]}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <View style={styles.lineCopy}>
            <AppText weight="semibold">Delivery address</AppText>
            <AppText muted numberOfLines={2} style={styles.price}>
              {selected ? `${displayNickname(selected)} · ${selected.line}` : 'Add where this order should go'}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => setPaymentOpen(true)}
          style={({ pressed }) => [styles.card, styles.offer, pressed && styles.pressed]}>
          <Ionicons name="cash-outline" size={18} color={colors.primary} />
          <View style={styles.lineCopy}>
            <AppText weight="semibold">Payment method</AppText>
            <AppText muted style={styles.price}>
              Cash on delivery
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        {closed ? (
          <View style={styles.warn}>
            <Ionicons name="time-outline" size={16} color={colors.primaryDark} />
            <AppText style={styles.warnText}>This kitchen is closed right now, so the order cannot be placed.</AppText>
          </View>
        ) : null}
      </ScrollView>
      <StickyAction
        leading={formatInr(cart.total)}
        label="Proceed to Checkout"
        disabled={closed}
        onPress={() => router.push('/(customer)/checkout')}
      />
      <AddressSheet visible={addressOpen} onClose={() => setAddressOpen(false)} />
      <PaymentSheet visible={paymentOpen} onClose={() => setPaymentOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  kitchen: { paddingTop: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  lineBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  image: { width: 56, height: 56, borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: colors.primary, fontSize: 16 },
  lineCopy: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1 },
  price: { fontSize: 13 },
  addMore: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  addMoreText: { color: colors.primary },
  pressed: { opacity: 0.72 },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  section: { fontSize: 16, paddingTop: 6 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  note: { fontSize: 12, paddingBottom: 8 },
  warn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: 12,
  },
  warnText: { flex: 1, color: colors.primaryDark, fontSize: 13, lineHeight: 18 },
});
