import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radii } from '@/constants/theme';

type Variant = 'list' | 'feature' | 'rail';

function usePulse() {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
      -1,
      true,
    );
  }, [opacity]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

/** A single pulsing placeholder block. */
export function SkeletonBlock({
  width = '100%',
  height = 12,
  radius = 6,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const pulse = usePulse();
  return (
    <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.border }, style, pulse]} />
  );
}

/** Content-shaped loading placeholders (Reanimated, UI thread). */
export function Skeleton({ rows = 3, variant = 'list' }: { rows?: number; variant?: Variant }) {
  const pulse = usePulse();
  const items = Array.from({ length: rows }, (_, index) => index);

  if (variant === 'rail') {
    return (
      <View style={styles.rail}>
        {items.map((index) => (
          <Animated.View key={index} style={[styles.railCard, pulse]}>
            <View style={styles.railImage} />
            <View style={styles.copy}>
              <View style={styles.line} />
              <View style={[styles.line, styles.short]} />
            </View>
          </Animated.View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {items.map((index) =>
        variant === 'feature' ? (
          <Animated.View key={index} style={[styles.feature, pulse]}>
            <View style={styles.featureImage} />
            <View style={styles.featureCopy}>
              <View style={styles.line} />
              <View style={[styles.line, styles.short]} />
              <View style={[styles.line, styles.shorter]} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key={index} style={[styles.card, pulse]}>
            <View style={styles.image} />
            <View style={styles.copy}>
              <View style={styles.line} />
              <View style={[styles.line, styles.short]} />
              <View style={[styles.line, styles.shorter]} />
            </View>
          </Animated.View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  rail: { flexDirection: 'row', gap: 8 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  image: { width: 88, height: 72, borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  copy: { flex: 1, justifyContent: 'center', gap: 8, padding: 2 },
  line: { height: 12, borderRadius: 6, backgroundColor: colors.border, width: '80%' },
  short: { width: '56%' },
  shorter: { width: '36%' },
  feature: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  featureImage: { height: 160, backgroundColor: colors.primarySoft },
  featureCopy: { padding: 12, gap: 8 },
  railCard: {
    width: 112,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  railImage: { height: 84, backgroundColor: colors.primarySoft },
});
