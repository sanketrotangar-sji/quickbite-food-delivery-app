import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { VegMark } from '@/components/VegMark';
import { colors, formatInr, motion, radii } from '@/constants/theme';
import type { HomeDish } from '@/lib/home-catalog';
import { RemoteImage } from '@/components/RemoteImage';

export function PopularDishCard({
  dish,
  width,
  liked,
  onToggleLike,
  onAdd,
  onPress,
  rating,
  ratingLabel,
}: {
  dish: HomeDish;
  width: number;
  liked: boolean;
  onToggleLike: () => void;
  onAdd: () => void | Promise<void>;
  onPress: () => void;
  rating?: number | null;
  ratingLabel?: string | null;
}) {
  const added = useSharedValue(0);
  const plusStyle = useAnimatedStyle(() => ({ opacity: 1 - added.value }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: added.value }));

  function playAdded() {
    const reduceMotion = ReduceMotion.System;
    added.value = withSequence(
      withTiming(1, { duration: motion.fast, reduceMotion }),
      withDelay(700, withTiming(0, { duration: motion.base, reduceMotion })),
    );
  }

  return (
    <Pressable onPress={onPress} style={[styles.card, { width }]}>
      <View>
        <RemoteImage uri={dish.imageUrl} fallbackText={dish.name} slot="thumb" style={styles.image} />
        <Pressable
          onPress={onToggleLike}
          hitSlop={12}
          style={styles.heart}
          accessibilityRole="button"
          accessibilityLabel={liked ? `Remove ${dish.name} from favorites` : `Save ${dish.name}`}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={12} color={liked ? colors.primary : colors.text} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <VegMark veg={dish.veg} size={10} />
          <AppText weight="bold" numberOfLines={1} style={styles.name}>
            {dish.name}
          </AppText>
        </View>
        <AppText muted numberOfLines={1} style={styles.meta}>
          {dish.restaurantName}
        </AppText>
        {rating != null || ratingLabel ? (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={10} color={colors.star} />
            <AppText muted style={styles.ratingText}>
              {rating != null ? rating.toFixed(1) : ''}
              {ratingLabel ? ` ${ratingLabel}` : ''}
            </AppText>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <AppText weight="bold" style={styles.price}>
            {formatInr(dish.price)}
          </AppText>
          <PressableScale
            onPress={() => {
              playAdded();
              void onAdd();
            }}
            haptic
            scaleTo={0.85}
            hitSlop={12}
            accessibilityRole="button"
            style={styles.add}
            accessibilityLabel={`Add ${dish.name}`}>
            <Animated.View style={[styles.addIcon, plusStyle]}>
              <Ionicons name="add" size={14} color={colors.white} />
            </Animated.View>
            <Animated.View style={[styles.addIcon, styles.checkIcon, checkStyle]}>
              <Ionicons name="checkmark" size={14} color={colors.white} />
            </Animated.View>
          </PressableScale>
        </View>
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
  image: { width: '100%', height: 72, backgroundColor: colors.primarySoft },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: colors.primary, fontSize: 16 },
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
  body: { paddingHorizontal: 8, paddingVertical: 6, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flex: 1, fontSize: 12 },
  meta: { fontSize: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 9 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  price: { color: colors.primary, fontSize: 12 },
  add: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addIcon: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    backgroundColor: colors.success,
    borderRadius: 11,
  },
});
