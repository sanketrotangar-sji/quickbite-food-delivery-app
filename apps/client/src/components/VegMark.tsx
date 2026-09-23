import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

export function VegMark({ veg, size = 14 }: { veg: boolean; size?: number }) {
  const color = veg ? colors.success : colors.danger;
  const dot = Math.max(4, Math.round(size * 0.38));
  return (
    <View style={[styles.box, { width: size, height: size, borderColor: color, borderRadius: 3 }]}>
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
