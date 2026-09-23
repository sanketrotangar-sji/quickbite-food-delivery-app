import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';
import type { HomeCategory } from '@/lib/home-mock';

export const CRAVING_SIZE = 64;

export function CravingCircle({
  category,
  selected = false,
  onPress,
}: {
  category: HomeCategory;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.item}>
      {category.imageUrl ? (
        <Image source={{ uri: category.imageUrl }} style={[styles.image, selected && styles.imageOn]} />
      ) : (
        <View style={[styles.image, styles.fallback, selected && styles.imageOn]}>
          <AppText weight="bold" style={styles.fallbackText}>
            {category.label.slice(0, 1).toUpperCase()}
          </AppText>
        </View>
      )}
      <AppText weight={selected ? 'semibold' : 'medium'} numberOfLines={1} style={[styles.label, selected && styles.labelOn]}>
        {category.label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { width: CRAVING_SIZE, alignItems: 'center', gap: 6 },
  image: {
    width: CRAVING_SIZE,
    height: CRAVING_SIZE,
    borderRadius: CRAVING_SIZE / 2,
    backgroundColor: colors.primarySoft,
  },
  imageOn: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: colors.primary, fontSize: 18 },
  label: { fontSize: 11, textAlign: 'center', color: colors.textMuted },
  labelOn: { color: colors.primary },
});
