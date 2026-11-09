import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';

export function ExploreFilterChip({ count, onPress }: { count: number; onPress: () => void }) {
  const active = count > 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={active ? `Filters, ${count} active` : 'Filters'}
      style={[styles.chip, active && styles.chipOn]}>
      <Ionicons name="options-outline" size={14} color={active ? colors.white : colors.text} />
      <AppText weight="semibold" style={[styles.label, active && styles.labelOn]}>
        {active ? `Filters · ${count}` : 'Filters'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
