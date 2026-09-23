import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';
import type { HomeCategory } from '@/lib/home-mock';

export function CuisineCard({
  category,
  selected,
  onPress,
}: {
  category: HomeCategory;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={category.label}
      style={styles.item}>
      <View style={[styles.frame, selected && styles.frameOn]}>
        {category.imageUrl ? (
          <Image source={{ uri: category.imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.image}>
            <AppText weight="bold" style={styles.fallback}>
              {category.label.slice(0, 1).toUpperCase()}
            </AppText>
          </View>
        )}
      </View>
      <AppText weight="medium" numberOfLines={2} style={[styles.label, selected && styles.labelOn]}>
        {category.label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { width: 76, alignItems: 'center', gap: 6, backgroundColor: 'transparent' },
  frame: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  frameOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  image: { width: 64, height: 64, borderRadius: 13, backgroundColor: 'transparent' },
  fallback: { color: colors.text, fontSize: 18, textAlign: 'center', lineHeight: 64 },
  label: { fontSize: 11, textAlign: 'center', color: colors.text },
  labelOn: { color: colors.primary },
});
