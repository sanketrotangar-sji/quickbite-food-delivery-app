import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { SectionHeader } from '@/components/SectionHeader';
import { colors } from '@/constants/theme';

type Row = { id: string; label: string; body: string; icon: keyof typeof Ionicons.glyphMap };

export function RestaurantInfo({ rows }: { rows: Row[] }) {
  const [openId, setOpenId] = useState<string | null>(rows[0]?.id ?? null);

  return (
    <View style={styles.wrap}>
      <SectionHeader title="About this restaurant" />
      {rows.map((row) => {
        const open = row.id === openId;
        return (
          <View key={row.id} style={styles.item}>
            <Pressable
              onPress={() => setOpenId((current) => (current === row.id ? null : row.id))}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              style={styles.head}>
              <Ionicons name={row.icon} size={16} color={colors.text} />
              <AppText weight="semibold" style={styles.label}>
                {row.label}
              </AppText>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </Pressable>
            {open ? (
              <AppText muted style={styles.body}>
                {row.body}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  item: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  label: { flex: 1, fontSize: 14 },
  body: { fontSize: 13, lineHeight: 18, paddingBottom: 6, paddingLeft: 24 },
});
