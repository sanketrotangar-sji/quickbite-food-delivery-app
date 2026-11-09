import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { colors, radii, spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'google';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  /** Optional leading icon (e.g. Google mark on outline buttons). */
  leading?: ReactNode;
};

export function Button({ label, onPress, loading, disabled, variant = 'primary', style, leading }: Props) {
  const isDisabled = disabled || loading;
  const labelColor =
    variant === 'primary' || variant === 'secondary' ? colors.white : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      haptic={variant === 'primary'}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[styles.base, variantStyles[variant], isDisabled && styles.disabled, style]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
      ) : (
        <View style={styles.content}>
          {leading}
          <AppText weight="semibold" style={{ color: labelColor }}>
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  disabled: { opacity: 0.5 },
});

const variantStyles = StyleSheet.create({
  /** Previous primary fill: colors.primary (#F15A24); uses primaryDark (#D44812) for white label contrast */
  primary: { backgroundColor: colors.primaryDark },
  secondary: { backgroundColor: colors.secondary },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  google: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
