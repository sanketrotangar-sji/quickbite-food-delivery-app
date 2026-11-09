import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';

export function VegToggleChip({ on, onPress }: { on: boolean; onPress: () => void }) {
  const tint = on ? colors.white : colors.veg;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="Pure veg only"
      style={[styles.chip, on && styles.chipOn]}>
      <Ionicons name="leaf" size={14} color={tint} />
      <AppText weight="semibold" style={[styles.label, { color: tint }]}>
        Pure Veg
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.veg, borderColor: colors.veg },
  label: { fontSize: 13 },
});
