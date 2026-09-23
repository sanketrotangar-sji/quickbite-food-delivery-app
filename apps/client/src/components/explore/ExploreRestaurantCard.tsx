import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import type { HomePlace } from '@/lib/home-mock';
import { placePresentation } from '@/lib/home-presentation';

export function ExploreRestaurantCard({
  place,
  priceLabel,
  liked,
  onToggleLike,
  onPress,
}: {
  place: HomePlace;
  priceLabel: string;
  liked: boolean;
  onToggleLike: () => void;
  onPress: () => void;
}) {
  const offer = placePresentation(place);
  const diet = place.veg ? 'Pure Veg' : place.hasNonVeg ? 'Veg & non-veg' : 'Menu';
  const rating = place.rating != null ? place.rating.toFixed(1) : 'New';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={place.name}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, !place.isOpen && styles.closed]}>
      <View>
        {place.imageUrl ? (
          <Image source={{ uri: place.imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.fallback]}>
            <AppText weight="bold" style={styles.fallbackText}>
              {place.name.slice(0, 1).toUpperCase()}
            </AppText>
          </View>
        )}
        <View style={styles.offer}>
          <AppText weight="bold" style={styles.offerText}>
            {offer.discount}% OFF
          </AppText>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onToggleLike();
          }}
          hitSlop={6}
          style={styles.heart}
          accessibilityRole="button"
          accessibilityLabel={liked ? `Remove ${place.name} from favorites` : `Save ${place.name}`}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? colors.primary : colors.text} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <AppText weight="bold" numberOfLines={1} style={styles.name}>
          {place.name}
        </AppText>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#E0A106" />
          <AppText weight="semibold" style={styles.rating}>
            {place.rating != null ? `${rating} · ${offer.reviewsLabel}` : 'New'}
          </AppText>
          {!place.isOpen ? (
            <AppText muted style={styles.meta}>
              Closed
            </AppText>
          ) : null}
        </View>
        <AppText muted numberOfLines={1} style={styles.meta}>
          {place.cuisine} · {diet}
        </AppText>
        {priceLabel ? (
          <AppText muted numberOfLines={1} style={styles.meta}>
            {priceLabel}
          </AppText>
        ) : null}
        <AppText muted numberOfLines={1} style={styles.meta}>
          {offer.eta} · Free delivery above ₹{offer.freeAbove}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.86 },
  closed: { opacity: 0.72 },
  image: { width: '100%', height: 168, backgroundColor: colors.primarySoft },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: colors.primary, fontSize: 22 },
  offer: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.primary,
  },
  offerText: { color: colors.white, fontSize: 11 },
  heart: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 12, paddingVertical: 12, gap: 3 },
  name: { fontSize: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 13 },
  meta: { fontSize: 12 },
});
