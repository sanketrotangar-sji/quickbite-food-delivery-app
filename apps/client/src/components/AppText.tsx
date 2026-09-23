import { Text, type TextProps } from 'react-native';

import { colors, fonts } from '@/constants/theme';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const fontMap: Record<Weight, string> = {
  regular: fonts.regular,
  medium: fonts.medium,
  semibold: fonts.semibold,
  bold: fonts.bold,
};

type Props = TextProps & { weight?: Weight; muted?: boolean; heading?: boolean };

export function AppText({ weight = 'regular', muted, heading, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: heading ? (weight === 'medium' || weight === 'semibold' ? fonts.headingMedium : fonts.heading) : fontMap[weight],
          color: muted ? colors.textMuted : colors.text,
        },
        style,
      ]}
    />
  );
}
