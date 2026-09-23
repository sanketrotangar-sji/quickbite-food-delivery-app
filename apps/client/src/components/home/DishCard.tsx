import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, formatInr } from '@/constants/theme';
import type { HomeDish } from '@/lib/home-mock';

export function DishCard({
  dish,
  width,
  liked,
  onPress,
  onToggleLike,
}: {
  dish: HomeDish;
  width: number;
  liked: boolean;
  onPress: () => void;
  onToggleLike: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.card, { width }]}>
      <View>
        {dish.imageUrl ? (
          <Image source={{ uri: dish.imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.fallback]}>
            <AppText weight="bold" style={styles.fallbackText}>
              {dish.name.slice(0, 1).toUpperCase()}
            </AppText>
          </View>
        )}
        {dish.discountPercent ? (
          <View style={styles.badge}>
            <AppText weight="bold" style={styles.badgeText}>
              {dish.discountPercent}%
            </AppText>
          </View>
        ) : null}
        <Pressable onPress={onToggleLike} hitSlop={6} style={styles.heart}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={12}
            color={liked ? colors.primary : colors.text}
          />
        </Pressable>
      </View>
      <View style={styles.body}>
        <AppText heading weight="semibold" numberOfLines={1} style={styles.name}>
          {dish.name}
        </AppText>
        <AppText muted numberOfLines={1} style={styles.restaurant}>
          {dish.restaurantName}
        </AppText>
        <AppText weight="bold" style={styles.price}>
          {formatInr(dish.price)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: 84, backgroundColor: colors.primarySoft },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: colors.primary, fontSize: 18 },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: { color: colors.white, fontSize: 9 },
  heart: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 6, paddingTop: 5, paddingBottom: 6 },
  name: { fontSize: 11, lineHeight: 14 },
  restaurant: { fontSize: 10, marginTop: 1 },
  price: { color: colors.primary, fontSize: 11, marginTop: 2 },
});
