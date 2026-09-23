import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';

export function OnlineStatusCard({ online, onChange }: { online: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={styles.card}>
      <View style={[styles.dot, online ? styles.dotOn : styles.dotOff]} />
      <View style={styles.copy}>
        <AppText weight="bold">{online ? "You're Online" : "You're offline"}</AppText>
        <AppText muted style={styles.sub}>
          {online ? 'Ready to receive new orders' : 'You will not receive new orders'}
        </AppText>
      </View>
      <Switch
        value={online}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
        accessibilityLabel={online ? 'Go offline' : 'Go online'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: colors.success },
  dotOff: { backgroundColor: colors.textMuted },
  copy: { flex: 1, gap: 2 },
  sub: { fontSize: 12 },
});
