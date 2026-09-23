import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii, spacing } from '@/constants/theme';
import type { Restaurant } from '@/types/models';

export function RestaurantCard({
  restaurant,
  onPress,
}: {
  restaurant: Restaurant;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, !restaurant.is_open && styles.closed, pressed && styles.pressed]}>
      {restaurant.image_url ? (
        <Image source={{ uri: restaurant.image_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <AppText weight="bold" style={{ color: colors.white, fontSize: 22 }}>
            {restaurant.name.slice(0, 1).toUpperCase()}
          </AppText>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <AppText weight="semibold" style={styles.name}>
            {restaurant.name}
          </AppText>
          <View style={[styles.pill, restaurant.is_open ? styles.openPill : styles.closedPill]}>
            <AppText weight="semibold" style={{ fontSize: 11, color: restaurant.is_open ? colors.secondary : colors.textMuted }}>
              {restaurant.is_open ? 'Open' : 'Closed'}
            </AppText>
          </View>
        </View>
        <AppText muted>{restaurant.cuisine || 'Multi-cuisine'}</AppText>
        <AppText muted style={{ fontSize: 13 }} numberOfLines={1}>
          {restaurant.address}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closed: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  image: {
    width: 88,
    height: 88,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { backgroundColor: colors.secondary },
  body: { flex: 1, justifyContent: 'center', gap: 4, paddingRight: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, flex: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  openPill: { backgroundColor: '#D8F3DC' },
  closedPill: { backgroundColor: '#ECECEC' },
});
