import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';

export function TripMap({
  from,
  to,
  height,
  caption = 'Route preview',
}: {
  from: string;
  to: string;
  height: number;
  caption?: string;
}) {
  const mid = Math.max(24, height * 0.38);

  return (
    <View style={[styles.map, { height }]} accessibilityLabel={`Route from ${from} to ${to}`}>
      <View style={[styles.hLine, { top: height * 0.22 }]} />
      <View style={[styles.hLine, { top: height * 0.4 }]} />
      <View style={[styles.hLine, { top: height * 0.58 }]} />
      <View style={[styles.vLine, { left: '22%' }]} />
      <View style={[styles.vLine, { left: '48%' }]} />
      <View style={[styles.vLine, { left: '74%' }]} />
      <View style={[styles.path, { top: mid }]} />
      <View style={[styles.pin, { left: 28, top: mid - 16 }]}>
        <View style={styles.pinDot} />
      </View>
      <View style={[styles.pin, { right: 36, top: mid + 18 }]}>
        <View style={[styles.pinDot, styles.pinDotTo]} />
      </View>
      <View style={styles.caption}>
        <AppText weight="semibold" style={styles.captionTitle}>
          {caption}
        </AppText>
        <AppText numberOfLines={1} style={styles.captionMeta}>
          {from} → {to}
        </AppText>
        <AppText style={styles.captionMeta}>Distance shows on this route</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#E7F0EA',
    borderWidth: 1,
    borderColor: colors.border,
  },
  hLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(45, 74, 66, 0.08)' },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(45, 74, 66, 0.08)' },
  path: {
    position: 'absolute',
    left: '18%',
    width: '52%',
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    transform: [{ rotate: '16deg' }],
  },
  pin: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  pinDotTo: { backgroundColor: colors.secondary },
  caption: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(251, 247, 242, 0.92)',
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 1,
  },
  captionTitle: { fontSize: 13 },
  captionMeta: { fontSize: 12, color: colors.textMuted },
});
