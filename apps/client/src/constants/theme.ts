import { brandHex, motion as motionTokens, typeScale } from '@quickbite/domain';

export const colors = {
  background: brandHex.background,
  surface: brandHex.surface,
  primary: brandHex.primary,
  primaryDark: brandHex.primaryDark,
  primarySoft: brandHex.primarySoft,
  primarySoftMid: brandHex.primarySoftMid,
  primaryWash: brandHex.primaryWash,
  primaryTintBorder: brandHex.primaryTintBorder,
  secondary: brandHex.forest,
  forest: brandHex.forest,
  forestMuted: brandHex.forestMuted,
  forestForeground: brandHex.forestForeground,
  success: brandHex.success,
  successSoft: brandHex.successSoft,
  successBorder: brandHex.successBorder,
  star: brandHex.star,
  starSoft: brandHex.starSoft,
  veg: brandHex.veg,
  vegSoft: brandHex.vegSoft,
  warning: brandHex.warning,
  warningSoft: brandHex.warningSoft,
  info: brandHex.info,
  infoSoft: brandHex.infoSoft,
  quick: brandHex.quick,
  quickSoft: brandHex.quickSoft,
  text: brandHex.text,
  textMuted: brandHex.textMuted,
  border: brandHex.border,
  stepTrack: brandHex.stepTrack,
  stepTrackBorder: brandHex.stepTrackBorder,
  stepLine: brandHex.stepLine,
  white: brandHex.white,
  danger: brandHex.danger,
  dangerSoft: brandHex.dangerSoft,
  dangerBorder: brandHex.dangerBorder,
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

export const type = typeScale;
export const motion = motionTokens;

export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
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
