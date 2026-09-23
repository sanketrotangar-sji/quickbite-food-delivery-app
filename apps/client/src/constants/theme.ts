export const colors = {
  background: '#FBF7F2',
  surface: '#FFFFFF',
  primary: '#F15A24',
  primaryDark: '#D44812',
  primarySoft: '#FFE8DC',
  secondary: '#2D4A42',
  forest: '#2D4A42',
  forestMuted: '#3F6358',
  forestForeground: '#F7F3EA',
  success: '#4A8B6F',
  successSoft: '#DCECE4',
  text: '#1F1C19',
  textMuted: '#8D877F',
  border: '#EFE8E0',
  white: '#FFFFFF',
  danger: '#B42318',
  overlay: 'rgba(58, 56, 52, 0.45)',
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
