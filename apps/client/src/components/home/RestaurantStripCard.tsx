import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { VegMark } from '@/components/VegMark';
import { colors, radii } from '@/constants/theme';
import type { HomePlace } from '@/lib/home-mock';
import { placePresentation } from '@/lib/home-presentation';

export function RestaurantStripCard({
  place,
  width,
  liked,
  onToggleLike,
  onPress,
  layout = 'rail',
}: {
  place: HomePlace;
  width?: number;
  liked: boolean;
  onToggleLike: () => void;
  onPress: () => void;
  layout?: 'rail' | 'list';
}) {
  const diet = place.veg ? 'Pure veg' : place.hasNonVeg ? 'Veg & non-veg' : 'Menu';
  const offer = placePresentation(place);

  if (layout === 'list') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.listCard, pressed && styles.pressed, !place.isOpen && styles.closed]}>
        <View>
          {place.imageUrl ? (
            <Image source={{ uri: place.imageUrl }} style={styles.listImage} />
          ) : (
            <View style={[styles.listImage, styles.fallback]}>
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
          <Pressable onPress={onToggleLike} hitSlop={6} style={styles.heart} accessibilityLabel="Favorite">
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color={liked ? colors.primary : colors.text} />
          </Pressable>
        </View>
        <View style={styles.listBody}>
          <AppText weight="bold" numberOfLines={1} style={styles.listName}>
            {place.name}
          </AppText>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#E0A106" />
            <AppText weight="semibold" style={styles.listRating}>
              {place.rating != null ? place.rating.toFixed(1) : 'New'}
            </AppText>
            <VegMark veg={place.veg} size={12} />
            <AppText muted style={styles.listMeta}>
              {place.isOpen ? 'Open' : 'Closed'}
            </AppText>
          </View>
          <AppText muted numberOfLines={1} style={styles.listMeta}>
            {place.cuisine} · {diet}
          </AppText>
          <AppText muted numberOfLines={1} style={styles.listMeta}>
            {offer.eta} · Free delivery above ₹{offer.freeAbove}
          </AppText>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={[styles.card, width ? { width } : null, !place.isOpen && styles.closed]}>
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
        <View style={[styles.status, place.isOpen ? styles.open : styles.shut]}>
          <AppText weight="bold" style={styles.statusText}>
            {place.isOpen ? 'Open' : 'Closed'}
          </AppText>
        </View>
        <Pressable onPress={onToggleLike} hitSlop={6} style={styles.heart}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={12} color={liked ? colors.primary : colors.text} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <AppText weight="bold" numberOfLines={1} style={styles.name}>
          {place.name}
        </AppText>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={10} color="#E0A106" />
          <AppText weight="semibold" style={styles.rating}>
            {place.rating != null ? place.rating.toFixed(1) : 'New'}
          </AppText>
          <VegMark veg={place.veg} size={10} />
        </View>
        <AppText muted numberOfLines={1} style={styles.meta}>
          {place.cuisine} · {diet}
        </AppText>
        <AppText muted numberOfLines={1} style={styles.meta}>
          {place.dishName}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  closed: { opacity: 0.72 },
  image: { width: '100%', height: 78, backgroundColor: colors.primarySoft },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: colors.primary, fontSize: 16 },
  status: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  open: { backgroundColor: colors.success },
  shut: { backgroundColor: colors.text },
  statusText: { color: colors.white, fontSize: 9 },
  heart: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 8, paddingVertical: 6, gap: 1 },
  name: { fontSize: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating: { fontSize: 10, flex: 1 },
  meta: { fontSize: 10 },
  listCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  pressed: { opacity: 0.86 },
  listImage: { width: 104, height: 96, borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  offer: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: colors.primary,
  },
  offerText: { color: colors.white, fontSize: 9 },
  listBody: { flex: 1, justifyContent: 'center', gap: 3 },
  listName: { fontSize: 15 },
  listRating: { fontSize: 12 },
  listMeta: { fontSize: 12 },
});
