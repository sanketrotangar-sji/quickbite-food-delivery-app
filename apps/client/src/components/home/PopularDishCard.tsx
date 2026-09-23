import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { VegMark } from '@/components/VegMark';
import { colors, formatInr, radii } from '@/constants/theme';
import type { HomeDish } from '@/lib/home-mock';

export function PopularDishCard({
  dish,
  width,
  liked,
  onToggleLike,
  onAdd,
  onPress,
}: {
  dish: HomeDish;
  width: number;
  liked: boolean;
  onToggleLike: () => void;
  onAdd: () => void | Promise<void>;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const added = useRef(new Animated.Value(0)).current;
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  function playAdded() {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    scale.setValue(1);
    added.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.82, duration: 90, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(added, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(added, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
    ]).start();
  }

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
        <Pressable onPress={onToggleLike} hitSlop={6} style={styles.heart}>
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
        <View style={styles.priceRow}>
          <AppText weight="bold" style={styles.price}>
            {formatInr(dish.price)}
          </AppText>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
              onPress={() => {
                playAdded();
                void onAdd();
              }}
              style={styles.add}
              accessibilityLabel={`Add ${dish.name}`}>
              <Animated.View style={[styles.addIcon, { opacity: added.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
                <Ionicons name="add" size={14} color={colors.white} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.addIcon,
                  styles.checkIcon,
                  { opacity: added },
                ]}>
                <Ionicons name="checkmark" size={14} color={colors.white} />
              </Animated.View>
            </Pressable>
          </Animated.View>
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
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  price: { color: colors.primary, fontSize: 12 },
  add: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
