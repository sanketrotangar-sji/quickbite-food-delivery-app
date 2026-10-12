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

const FALLBACK_FOOD =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';

export function RemoteImage({
  uri,
  slot = 'thumb',
  style,
  contentFit = 'cover',
  recyclingKey,
  ...rest
}: Props) {
  const resolved = getDisplayImageUrl(uri, slot) || FALLBACK_FOOD;
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
