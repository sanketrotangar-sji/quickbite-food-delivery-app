import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';

export type CuisineChip = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
};

export function CategoryChips({
  chips,
  selectedId,
  onSelect,
  leading,
}: {
  chips: CuisineChip[];
  selectedId: string;
  onSelect: (id: string) => void;
  leading?: ReactNode;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {leading}
      {chips.map((chip) => {
        const selected = chip.id === selectedId;
        const tint = selected ? colors.white : (chip.tint ?? colors.text);
        return (
          <Pressable
            key={chip.id}
            onPress={() => onSelect(chip.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipOn]}>
            <Ionicons name={chip.icon} size={14} color={tint} />
            <AppText weight="semibold" style={[styles.label, selected && styles.labelOn, !selected && chip.tint ? { color: chip.tint } : null]}>
              {chip.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 4, alignItems: 'center' },
  chip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontSize: 13, color: colors.text },
  labelOn: { color: colors.white },
});
