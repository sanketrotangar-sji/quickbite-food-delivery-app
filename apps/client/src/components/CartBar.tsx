import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, formatInr, radii, spacing } from '@/constants/theme';

export function CartBar({
  itemCount,
  subtotal,
  onPress,
  bottomOffset = 0,
}: {
  itemCount: number;
  subtotal: number;
  onPress: () => void;
  bottomOffset?: number;
}) {
  const insets = useSafeAreaInsets();
  if (itemCount < 1) return null;

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) + bottomOffset },
      ]}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.bar, pressed && { opacity: 0.92 }]}>
        <AppText weight="semibold" style={{ color: colors.white }}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatInr(subtotal)}
        </AppText>
        <AppText weight="bold" style={{ color: colors.white }}>
          View Cart
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: 'transparent',
  },
  bar: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
