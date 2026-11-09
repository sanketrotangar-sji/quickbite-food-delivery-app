import { Text, type TextProps } from 'react-native';

import { colors, fonts, type } from '@/constants/theme';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
export type TextVariant = keyof typeof type;

const fontMap: Record<Weight, string> = {
  regular: fonts.regular,
  medium: fonts.medium,
  semibold: fonts.semibold,
  bold: fonts.bold,
};

type Props = TextProps & { weight?: Weight; muted?: boolean; heading?: boolean; variant?: TextVariant };

export function AppText({ weight = 'regular', muted, heading, variant, style, maxFontSizeMultiplier = 1.35, ...rest }: Props) {
  const scale = variant ? type[variant] : null;
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={[
        {
          fontFamily: heading ? (weight === 'medium' || weight === 'semibold' ? fonts.headingMedium : fonts.heading) : fontMap[weight],
          color: muted ? colors.textMuted : colors.text,
        },
        scale ? { fontSize: scale.size, lineHeight: scale.line } : null,
        style,
      ]}
    />
  );
}
