import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, type ImageContentFit, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';
import { getDisplayImageUrl, type ImageSlot } from '@/lib/images';

type Props = {
  uri?: string | null;
  slot?: ImageSlot;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  recyclingKey?: string;
  /** Initial shown on the placeholder (kitchen / dish name). */
  fallbackText?: string | null;
  fallbackFontSize?: number;
} & Omit<ImageProps, 'source' | 'style' | 'contentFit'>;

/** Remote image with an offline-safe branded placeholder when the URL is empty or fails. */
export function RemoteImage({
  uri,
  slot = 'thumb',
  style,
  contentFit = 'cover',
  recyclingKey,
  fallbackText,
  fallbackFontSize,
  onError,
  ...rest
}: Props) {
  const resolved = getDisplayImageUrl(uri, slot);
  const [failedUri, setFailedUri] = useState<string | null>(null);

  if (!resolved || failedUri === resolved) {
    const initial = fallbackText?.trim().slice(0, 1).toUpperCase();
    return (
      <View style={[styles.fallback, style as StyleProp<ViewStyle>]} accessibilityLabel={fallbackText ?? 'Food'}>
        {initial ? (
          <AppText variant="bodyLg" weight="bold" style={[styles.fallbackText, fallbackFontSize ? { fontSize: fallbackFontSize } : null]}>
            {initial}
          </AppText>
        ) : (
          <Ionicons name="restaurant" size={22} color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <Image
      source={{ uri: resolved }}
      style={[styles.base, style]}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey ?? resolved}
      transition={120}
      onError={(event) => {
        setFailedUri(resolved);
        onError?.(event);
      }}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.border },
  fallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: colors.primary,
  },
});
