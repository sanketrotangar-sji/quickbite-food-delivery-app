import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import type { HomePlace } from '@/lib/home-mock';

export function RecPlaceCard({ place, onPress }: { place: HomePlace; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
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
        <AppText weight="semibold" numberOfLines={1} style={styles.name}>
          {place.name}
        </AppText>
        <AppText muted numberOfLines={1} style={styles.dish}>
          {place.dishName}
        </AppText>
        <View style={styles.meta}>
          {place.rating != null ? (
            <>
              <Ionicons name="star" size={10} color={colors.primary} />
              <AppText muted style={styles.metaText}>
                {place.rating.toFixed(1)}
              </AppText>
            </>
          ) : (
            <AppText muted style={styles.metaText}>
              {place.isOpen ? 'Open now' : 'Closed'}
            </AppText>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 132,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  image: { width: '100%', height: 86, backgroundColor: colors.primarySoft },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: colors.primary, fontSize: 18 },
  body: { paddingHorizontal: 8, paddingVertical: 7 },
  name: { fontSize: 12 },
  dish: { fontSize: 10, marginTop: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  metaText: { fontSize: 10 },
});
