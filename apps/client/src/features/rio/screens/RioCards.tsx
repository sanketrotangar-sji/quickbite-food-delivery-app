import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { RioCard, RioMenuItem, RioRestaurant } from '@quickbite/api/mobile/rio';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OrderCard } from '@/components/OrderCard';
import { PriceRow } from '@/components/PriceRow';
import { PopularDishCard } from '@/features/home/components/PopularDishCard';
import { RestaurantStripCard } from '@/features/home/components/RestaurantStripCard';
import { ORDER_STATUS_META, type OrderStatus } from '@/constants/orderStatus';
import { colors, elevation, formatInr, radii } from '@/constants/theme';
import type { HomeDish, HomePlace } from '@/lib/home-catalog';

const RAIL_GAP = 10;
const PAGE_PAD = 16;

export function RioCards({
  cards,
  liked,
  onToggleLike,
  onAddDish,
  onConfirm,
  onAddAddress,
  confirming,
  confirmHidden,
}: {
  cards: RioCard[];
  liked: ReadonlySet<string>;
  onToggleLike: (id: string) => void;
  onAddDish: (dish: HomeDish) => void | Promise<void>;
  onConfirm: () => void;
  onAddAddress: () => void;
  confirming: boolean;
  confirmHidden: boolean;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(172, Math.round((width - PAGE_PAD * 2 - RAIL_GAP) / 2.05));
  const placeWidth = Math.min(212, Math.round((width - PAGE_PAD * 2 - RAIL_GAP) / 1.85));

  if (!Array.isArray(cards) || cards.length === 0) return null;

  return (
    <View style={styles.stack}>
      {cards.map((card, index) => {
        if (!card || typeof card !== 'object' || !('kind' in card)) return null;

        if (card.kind === 'restaurants') {
          const places = Array.isArray(card.places) ? card.places.filter((p) => p && p.id && p.name) : [];
          if (places.length === 0) return null;
          return (
            <View key={`places-${index}`} style={styles.railSection}>
              <View style={styles.railHeader}>
                <View style={styles.railTitleRow}>
                  <Ionicons name="compass-outline" size={15} color={colors.primaryDark} />
                  <AppText weight="semibold" variant="meta" style={styles.railTitle}>
                    Matching kitchens
                  </AppText>
                </View>
                <View style={styles.countBadge}>
                  <AppText weight="semibold" variant="caption" style={styles.countBadgeText}>
                    {places.length} {places.length === 1 ? 'option' : 'options'}
                  </AppText>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}>
                {places.map((place) => (
                  <RestaurantStripCard
                    key={place.id}
                    layout="rail"
                    width={placeWidth}
                    place={toPlace(place)}
                    liked={liked.has(place.id)}
                    onToggleLike={() => onToggleLike(place.id)}
                    onPress={() => router.push(`/(customer)/restaurant/${place.id}`)}
                  />
                ))}
              </ScrollView>
            </View>
          );
        }

        if (card.kind === 'menu') {
          const items = Array.isArray(card.items) ? card.items.filter((i) => i && i.id && i.name) : [];
          if (items.length === 0) return null;
          return (
            <View key={`menu-${card.restaurantId}-${index}`} style={styles.railSection}>
              <Pressable
                onPress={() => router.push(`/(customer)/restaurant/${card.restaurantId}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${card.restaurantName} menu`}
                style={({ pressed }) => [styles.railHeader, styles.railHeaderTappable, pressed && styles.pressed]}>
                <View style={styles.railTitleRow}>
                  <Ionicons name="restaurant-outline" size={14} color={colors.primaryDark} />
                  <AppText weight="semibold" variant="meta" numberOfLines={1} style={styles.railTitle}>
                    {card.restaurantName || 'Kitchen picks'}
                  </AppText>
                </View>
                <View style={styles.linkRow}>
                  <AppText weight="semibold" variant="caption" style={styles.linkText}>
                    Full menu
                  </AppText>
                  <Ionicons name="chevron-forward" size={13} color={colors.primaryDark} />
                </View>
              </Pressable>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}>
                {items.map((item) => {
                  const dish = toHomeDish(item, card.restaurantName);
                  return (
                    <PopularDishCard
                      key={item.id}
                      width={cardWidth}
                      dish={dish}
                      liked={liked.has(item.id)}
                      onToggleLike={() => onToggleLike(item.id)}
                      onPress={() => router.push(`/(customer)/restaurant/${card.restaurantId}`)}
                      onAdd={() => onAddDish(dish)}
                    />
                  );
                })}
              </ScrollView>
            </View>
          );
        }

        if (card.kind === 'ticket') {
          const isHigh = String(card.urgency).toLowerCase() === 'high';
          const orderCode = String(card.orderId ?? '').replace(/-/g, '').slice(0, 6).toUpperCase();
          return (
            <View key={`ticket-${card.id}-${index}`} style={[styles.panel, elevation.card]}>
              <View style={styles.panelHead}>
                <View style={styles.iconCircle}>
                  <Ionicons name="headset-outline" size={16} color={colors.primaryDark} />
                </View>
                <View style={styles.panelHeadCopy}>
                  <AppText weight="bold" variant="body">
                    Support ticket opened
                  </AppText>
                  <AppText muted variant="meta">
                    {formatIssueLabel(card.issueType)} {orderCode ? `· Order #${orderCode}` : ''}
                  </AppText>
                </View>
                <View style={[styles.statusPill, isHigh ? styles.statusPillHigh : styles.statusPillNormal]}>
                  <AppText
                    weight="semibold"
                    variant="caption"
                    style={isHigh ? styles.statusPillHighText : styles.statusPillNormalText}>
                    {card.status || 'open'}
                  </AppText>
                </View>
              </View>
            </View>
          );
        }

        if (card.kind === 'cart') {
          const lines = Array.isArray(card.lines) ? card.lines : [];
          const discount = Number(card.discountAmount ?? 0);
          const fee = Number(card.deliveryFee ?? 0);
          const offer = Number(card.offerPercent ?? 0);
          const isSettled = Boolean(card.settled || confirmHidden);
          const itemCount = lines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
          return (
            <View key={`cart-${index}`} style={[styles.panel, elevation.card]}>
              <View style={styles.panelHead}>
                <View style={styles.iconCircle}>
                  <Ionicons name="bag-check-outline" size={16} color={colors.primaryDark} />
                </View>
                <View style={styles.panelHeadCopy}>
                  <AppText weight="bold" variant="body" numberOfLines={1}>
                    {card.restaurantName || 'Your cart'}
                  </AppText>
                  <AppText muted variant="caption">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} in bill summary
                  </AppText>
                </View>
                {isSettled ? (
                  <View style={styles.settledBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                    <AppText weight="semibold" variant="caption" style={styles.settledText}>
                      Settled
                    </AppText>
                  </View>
                ) : null}
              </View>

              <View style={styles.divider} />

              <View style={styles.linesBlock}>
                {lines.map((line, lineIdx) => (
                  <PriceRow
                    key={`${line.name}-${line.quantity}-${lineIdx}`}
                    label={`${line.quantity} × ${line.name}`}
                    value={formatInr(Number(line.quantity) * Number(line.unitPrice))}
                  />
                ))}
              </View>

              <View style={styles.divider} />

              {card.subtotal != null ? (
                <PriceRow label="Subtotal" value={formatInr(card.subtotal)} />
              ) : null}
              {discount > 0 ? (
                <PriceRow
                  label={offer > 0 ? `Offer (${offer}% off)` : 'Offer discount'}
                  value={`- ${formatInr(discount)}`}
                />
              ) : null}
              {fee > 0 || card.deliveryFee != null ? (
                <PriceRow label="Delivery fee" value={fee === 0 ? 'FREE' : formatInr(fee)} />
              ) : null}
              <PriceRow label="To pay" value={formatInr(card.total)} strong />

              {discount > 0 ? (
                <View style={styles.savingsBanner}>
                  <Ionicons name="pricetag-outline" size={13} color={colors.success} />
                  <AppText weight="semibold" variant="caption" style={styles.savingsText}>
                    You save {formatInr(discount)} on this order
                  </AppText>
                </View>
              ) : null}

              {card.needsAddress ? (
                <Button label="Add a delivery address" onPress={onAddAddress} variant="secondary" />
              ) : null}
              {card.confirm && !isSettled ? (
                <Button label={`Confirm & pay ${formatInr(card.total)}`} onPress={onConfirm} loading={confirming} />
              ) : null}
            </View>
          );
        }

        const status = asStatus(card.status);
        const parsedDate = card.placedAt ? new Date(card.placedAt) : null;
        const when =
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })
            : 'Just now';
        return (
          <OrderCard
            key={`${card.id}-${index}`}
            variant="compact"
            restaurantName={card.restaurantName}
            imageUrl={card.imageUrl}
            orderCode={`#${String(card.id ?? '').replace(/-/g, '').slice(0, 6).toUpperCase()}`}
            itemsSummary={card.itemsSummary}
            amount={formatInr(card.total)}
            status={status}
            when={when}
            address={card.address}
            onPress={() => router.push(`/(customer)/orders/${card.id}`)}
          />
        );
      })}
    </View>
  );
}

function formatIssueLabel(issue: string) {
  const cleaned = String(issue ?? 'order_issue').replace(/_/g, ' ').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function toPlace(place: RioRestaurant): HomePlace {
  return {
    id: place.id,
    name: place.name,
    cuisine: place.cuisine || 'Goan & Indian',
    dishName: place.dishName || '',
    rating: null,
    imageUrl: place.imageUrl ?? '',
    address: place.address || '',
    isOpen: place.isOpen !== false,
    veg: Boolean(place.veg),
    hasNonVeg: !place.veg,
    categoryIds: [],
    offerPercent: place.offerPercent ?? null,
    prepMinutes: place.prepMinutes ?? null,
    lat: null,
    lng: null,
    distanceKm: place.distanceKm ?? null,
  };
}

function toHomeDish(item: RioMenuItem, restaurantName: string): HomeDish {
  return {
    id: item.id,
    name: item.name,
    restaurantName: restaurantName || 'Kitchen',
    restaurantId: item.restaurantId,
    category: item.category ?? 'Menu',
    price: Number(item.price ?? 0),
    imageUrl: item.imageUrl ?? '',
    veg: Boolean(item.isVeg),
  };
}

function asStatus(status: string): OrderStatus {
  if (status in ORDER_STATUS_META) return status as OrderStatus;
  return 'placed';
}

const styles = StyleSheet.create({
  stack: { gap: 10, marginTop: 4 },
  railSection: { gap: 6 },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  railHeaderTappable: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryWash,
    borderWidth: 1,
    borderColor: colors.border,
  },
  railTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  railTitle: { color: colors.text },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  countBadgeText: { color: colors.primaryDark },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { color: colors.primaryDark },
  rail: { gap: RAIL_GAP, paddingRight: PAGE_PAD },
  panel: {
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHeadCopy: { flex: 1, gap: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  linesBlock: { gap: 4 },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.successSoft,
  },
  settledText: { color: colors.success },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.successSoft,
  },
  savingsText: { color: colors.success },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statusPillHigh: { backgroundColor: colors.dangerSoft },
  statusPillNormal: { backgroundColor: colors.primarySoft },
  statusPillHighText: { color: colors.danger },
  statusPillNormalText: { color: colors.primaryDark },
  pressed: { opacity: 0.78 },
});
