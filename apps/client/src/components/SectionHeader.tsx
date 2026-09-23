import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';

export function SectionHeader({
  title,
  actionLabel = 'See all',
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <AppText heading weight="semibold" style={styles.title}>
        {title}
      </AppText>
      {onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" style={styles.actionRow}>
          <AppText weight="semibold" style={styles.action}>
            {actionLabel}
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  title: { flex: 1, fontSize: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  action: { color: colors.primary, fontSize: 13 },
});
