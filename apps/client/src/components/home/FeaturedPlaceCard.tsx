import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import type { HomePlace } from '@/lib/home-mock';

export function FeaturedPlaceCard({ place, onPress }: { place: HomePlace; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, !place.isOpen && styles.closed]}>
      {place.imageUrl ? (
        <Image source={{ uri: place.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.fallback]}>
          <AppText weight="bold" style={styles.fallbackText}>
            {place.name.slice(0, 1).toUpperCase()}
          </AppText>
        </View>
      )}
      {!place.isOpen ? (
        <View style={styles.offer}>
          <AppText weight="bold" style={styles.offerText}>
            Closed
          </AppText>
        </View>
      ) : null}
      <View style={styles.body}>
        <View style={styles.row}>
          <AppText heading weight="semibold" style={styles.name} numberOfLines={1}>
            {place.name}
          </AppText>
          {place.rating != null ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={11} color={colors.white} />
              <AppText weight="bold" style={styles.ratingText}>
                {place.rating.toFixed(1)}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText muted numberOfLines={1} style={styles.meta}>
          {place.cuisine} · {place.dishName}
        </AppText>
        <AppText muted numberOfLines={1} style={styles.meta}>
          {place.address}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  closed: { opacity: 0.72 },
  image: { width: '100%', height: 168, backgroundColor: colors.primarySoft },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  fallbackText: { color: colors.white, fontSize: 28 },
  offer: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.text,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offerText: { color: colors.white, fontSize: 11 },
  body: { paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16 },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.success,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingText: { color: colors.white, fontSize: 11 },
  meta: { fontSize: 12 },
});
