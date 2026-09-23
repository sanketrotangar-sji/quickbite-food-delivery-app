import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RioCard, RioMenuItem, RioRestaurant } from '@/api/rio';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { MenuItemRow } from '@/components/MenuItemRow';
import { OrderCard } from '@/components/OrderCard';
import { PriceRow } from '@/components/PriceRow';
import { RestaurantStripCard } from '@/components/home/RestaurantStripCard';
import { ORDER_STATUS_META, type OrderStatus } from '@/constants/orderStatus';
import { colors, formatInr, radii } from '@/constants/theme';
import type { HomePlace } from '@/lib/home-mock';
import type { MenuItem } from '@/types/models';

export function RioCards({
  cards,
  liked,
  onToggleLike,
  onAddItem,
  onConfirm,
  onAddAddress,
  confirming,
  confirmHidden,
}: {
  cards: RioCard[];
  liked: ReadonlySet<string>;
  onToggleLike: (id: string) => void;
  onAddItem: (item: RioMenuItem) => void;
  onConfirm: () => void;
  onAddAddress: () => void;
  confirming: boolean;
  confirmHidden: boolean;
}) {
  return (
    <View style={styles.stack}>
      {cards.map((card, index) => {
        if (card.kind === 'restaurants') {
          return (
            <View key={`places-${index}`} style={styles.stack}>
              {card.places.map((place) => (
                <RestaurantStripCard
                  key={place.id}
                  layout="list"
                  place={toPlace(place)}
                  liked={liked.has(place.id)}
                  onToggleLike={() => onToggleLike(place.id)}
                  onPress={() => router.push(`/(customer)/restaurant/${place.id}`)}
                />
              ))}
            </View>
          );
        }
        if (card.kind === 'menu') {
          return (
            <View key={`menu-${card.restaurantId}-${index}`} style={styles.panel}>
              <AppText weight="semibold">{card.restaurantName}</AppText>
              {card.items.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={toMenuItem(item)}
                  quantity={0}
                  liked={liked.has(item.id)}
                  onToggleLike={() => onToggleLike(item.id)}
                  onAdd={() => onAddItem(item)}
                  onIncrease={() => onAddItem(item)}
                  onDecrease={() => undefined}
                />
              ))}
              <Pressable
                onPress={() => router.push(`/(customer)/restaurant/${card.restaurantId}`)}
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                <AppText weight="semibold" style={styles.linkText}>
                  See full menu
                </AppText>
              </Pressable>
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

function toMenuItem(item: RioMenuItem): MenuItem {
  return {
    id: item.id,
    restaurant_id: item.restaurantId,
    name: item.name,
    description: item.description,
    price: item.price,
    image_url: item.imageUrl,
    is_available: item.isAvailable,
    is_veg: item.isVeg,
    category: item.category,
    created_at: '',
    updated_at: '',
  };
}

function asStatus(status: string): OrderStatus {
  if (status in ORDER_STATUS_META) return status as OrderStatus;
  return 'placed';
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  panel: {
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  link: { alignSelf: 'flex-start', paddingVertical: 6 },
  linkText: { color: colors.primary, fontSize: 13 },
  pressed: { opacity: 0.72 },
});
