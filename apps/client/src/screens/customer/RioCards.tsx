import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { RioCard, RioMenuItem, RioRestaurant } from '@/api/rio';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OrderCard } from '@/components/OrderCard';
import { PriceRow } from '@/components/PriceRow';
import { PopularDishCard } from '@/components/home/PopularDishCard';
import { RestaurantStripCard } from '@/components/home/RestaurantStripCard';
import { ORDER_STATUS_META, type OrderStatus } from '@/constants/orderStatus';
import { colors, formatInr, radii } from '@/constants/theme';
import type { HomeDish, HomePlace } from '@/lib/home-mock';

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
  const cardWidth = Math.min(168, Math.round((width - PAGE_PAD * 2 - RAIL_GAP * 2) / 2.15));
  const placeWidth = Math.min(200, Math.round((width - PAGE_PAD * 2 - RAIL_GAP * 2) / 2.1));

  return (
    <View style={styles.stack}>
      {cards.map((card, index) => {
        if (card.kind === 'restaurants') {
          return (
            <ScrollView
              key={`places-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}>
              {card.places.map((place) => (
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
          );
        }
        if (card.kind === 'menu') {
          return (
            <ScrollView
              key={`menu-${card.restaurantId}-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}>
              {card.items.map((item) => {
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
          );
        }
        if (card.kind === 'ticket') {
          return (
            <View key={`ticket-${card.id}-${index}`} style={styles.panel}>
              <AppText weight="semibold">Support ticket opened</AppText>
              <AppText muted>
                {card.issueType} · {card.urgency} urgency · {card.status}
              </AppText>
              <AppText muted style={{ marginTop: 4 }}>
                Order #{card.orderId.replace(/-/g, '').slice(0, 6).toUpperCase()}
              </AppText>
            </View>
          );
        }
        if (card.kind === 'cart') {
          return (
            <View key={`cart-${index}`} style={styles.panel}>
              <AppText weight="semibold">{card.restaurantName}</AppText>
              {card.lines.map((line) => (
                <PriceRow
                  key={`${line.name}-${line.quantity}`}
                  label={`${line.quantity} × ${line.name}`}
                  value={formatInr(line.quantity * line.unitPrice)}
                />
              ))}
              <PriceRow label="Total" value={formatInr(card.total)} strong />
              {card.needsAddress ? (
                <Button label="Add a delivery address" onPress={onAddAddress} variant="secondary" />
              ) : null}
              {card.confirm && !confirmHidden ? (
                <Button label="Confirm order" onPress={onConfirm} loading={confirming} />
              ) : null}
            </View>
          );
        }
        const status = asStatus(card.status);
        const when = new Date(card.placedAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        });
        return (
          <OrderCard
            key={card.id}
            variant="compact"
            restaurantName={card.restaurantName}
            imageUrl={card.imageUrl}
            orderCode={`#${card.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`}
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

function toPlace(place: RioRestaurant): HomePlace {
  return {
    id: place.id,
    name: place.name,
    cuisine: place.cuisine,
    dishName: place.dishName,
    rating: null,
    imageUrl: place.imageUrl,
    address: place.address,
    isOpen: place.isOpen,
    veg: place.veg,
    hasNonVeg: false,
    categoryIds: [],
    offerPercent: place.offerPercent,
    prepMinutes: place.prepMinutes,
  };
}

function toHomeDish(item: RioMenuItem, restaurantName: string): HomeDish {
  return {
    id: item.id,
    name: item.name,
    restaurantName,
    restaurantId: item.restaurantId,
    category: item.category ?? 'Menu',
    price: item.price,
    imageUrl: item.imageUrl ?? '',
    veg: item.isVeg,
  };
}

function asStatus(status: string): OrderStatus {
  if (status in ORDER_STATUS_META) return status as OrderStatus;
  return 'placed';
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  rail: { gap: RAIL_GAP, paddingRight: PAGE_PAD },
  panel: {
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
});
