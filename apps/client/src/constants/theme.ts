import { brandHex } from '../../../../packages/shared/src/brand-tokens';

export const colors = {
  background: brandHex.background,
  surface: brandHex.surface,
  primary: brandHex.primary,
  primaryDark: brandHex.primaryDark,
  primarySoft: brandHex.primarySoft,
  secondary: brandHex.forest,
  forest: brandHex.forest,
  forestMuted: brandHex.forestMuted,
  forestForeground: brandHex.forestForeground,
  success: brandHex.success,
  successSoft: brandHex.successSoft,
  text: brandHex.text,
  textMuted: brandHex.textMuted,
  border: brandHex.border,
  white: brandHex.white,
  danger: brandHex.danger,
  overlay: brandHex.overlay,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heading: 'Sora_700Bold',
  headingMedium: 'Sora_600SemiBold',
} as const;

export const tabBarInset = 88;
/** Space under the status bar, matching the customer and rider home headers. */
export const screenTopGap = 8;

export function formatInr(amount: number | string) {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(value)) return '₹0';
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
