import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, formatInr, radii } from '@/constants/theme';
import type { RiderStats } from '@/features/rider/rider-home';

const ITEMS: {
  key: keyof RiderStats;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'deliveries', label: "Today's Deliveries", icon: 'cube-outline' },
  { key: 'earnings', label: "Today's Earnings", icon: 'cash-outline' },
  { key: 'activeTime', label: 'Active Time', icon: 'time-outline' },
  { key: 'rating', label: 'Rating', icon: 'star-outline' },
];

export function RiderStatsRow({ stats }: { stats: RiderStats }) {
  return (
    <View style={styles.card}>
      {ITEMS.map((item) => (
        <View key={item.key} style={styles.cell}>
          <View style={styles.icon}>
            <Ionicons name={item.icon} size={16} color={colors.primary} />
          </View>
          <AppText muted numberOfLines={2} style={styles.label}>
            {item.label}
          </AppText>
          <AppText weight="bold" style={styles.value}>
            {item.key === 'earnings' ? formatInr(stats.earnings) : String(stats[item.key])}
            {item.key === 'rating' ? ' ›' : ''}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  cell: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 2 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10, lineHeight: 13, textAlign: 'center' },
  value: { fontSize: 14, textAlign: 'center' },
});
