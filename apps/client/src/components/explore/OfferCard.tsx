import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import type { HomePlace } from '@/lib/home-mock';
import { placePresentation } from '@/lib/home-presentation';

export function OfferCard({ place, width, onPress }: { place: HomePlace; width: number; onPress: () => void }) {
  const offer = placePresentation(place);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${offer.discount}% off at ${place.name}`}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}>
      {place.imageUrl ? (
        <Image source={{ uri: place.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.fallback]}>
          <AppText weight="bold" style={styles.fallbackText}>
            {place.name.slice(0, 1).toUpperCase()}
          </AppText>
        </View>
      )}
      <View style={styles.body}>
        <AppText weight="bold" style={styles.discount}>
          {offer.discount}% OFF
        </AppText>
        <AppText weight="semibold" numberOfLines={1} style={styles.name}>
          {place.name}
        </AppText>
        <AppText muted numberOfLines={1} style={styles.meta}>
          {place.cuisine}
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
  pressed: { opacity: 0.86 },
  image: { width: '100%', height: 72, backgroundColor: colors.primarySoft },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: colors.primary, fontSize: 16 },
  body: { paddingHorizontal: 8, paddingVertical: 8, gap: 2 },
  discount: { color: colors.primary, fontSize: 12 },
  name: { fontSize: 12 },
  meta: { fontSize: 10 },
});
