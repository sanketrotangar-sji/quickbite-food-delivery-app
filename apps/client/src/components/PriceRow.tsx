import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';

export function PriceRow({
  label,
  value,
  strong,
  tone = 'default',
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'default' | 'success';
}) {
  return (
    <View style={styles.row}>
      <AppText weight={strong ? 'bold' : 'medium'} muted={!strong}>
        {label}
      </AppText>
      <AppText weight={strong ? 'bold' : 'semibold'} style={tone === 'success' ? styles.success : undefined}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  success: { color: colors.success },
});
