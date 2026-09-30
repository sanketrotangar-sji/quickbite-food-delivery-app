import { Image, type ImageContentFit, type ImageProps } from 'expo-image';
import { StyleSheet, type StyleProp, type ImageStyle } from 'react-native';

import { getDisplayImageUrl, type ImageSlot } from '@/lib/images';

type Props = {
  uri?: string | null;
  slot?: ImageSlot;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  recyclingKey?: string;
} & Omit<ImageProps, 'source' | 'style' | 'contentFit'>;

export function RemoteImage({
  uri,
  slot = 'thumb',
  style,
  contentFit = 'cover',
  recyclingKey,
  ...rest
}: Props) {
  const resolved = getDisplayImageUrl(uri, slot);
  if (!resolved) return null;
  return (
    <Image
      source={{ uri: resolved }}
      style={[styles.base, style]}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey ?? resolved}
      transition={120}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#ECE7DF' },
});
