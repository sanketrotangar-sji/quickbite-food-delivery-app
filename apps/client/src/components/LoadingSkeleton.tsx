import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

export function LoadingSkeleton({ rows = 3, variant = 'row' }: { rows?: number; variant?: 'row' | 'feature' }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.stack}>
      {Array.from({ length: rows }, (_, index) =>
        variant === 'feature' ? (
          <Animated.View key={index} style={[styles.feature, { opacity }]}>
            <View style={styles.featureImage} />
            <View style={styles.featureCopy}>
              <View style={styles.line} />
              <View style={[styles.line, styles.short]} />
              <View style={[styles.line, styles.shorter]} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key={index} style={[styles.card, { opacity }]}>
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
  copy: { flex: 1, justifyContent: 'center', gap: 8 },
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
});
