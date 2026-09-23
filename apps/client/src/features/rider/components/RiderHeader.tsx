import { Image, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';

export function RiderHeader({ online, onChange }: { online: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <Image
          source={require('../../../../assets/images/logo2.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="QuickBite"
        />
        <AppText style={styles.tagline} numberOfLines={1}>
          Good Food. Brighter Days.
        </AppText>
      </View>
      <View style={styles.duty}>
        <AppText weight="semibold" style={styles.dutyLabel}>
          {online ? 'On duty' : 'Start duty'}
        </AppText>
        <Switch
          value={online}
          onValueChange={onChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
          accessibilityLabel={online ? 'Take leave' : 'Start duty'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { width: 118 },
  logo: { width: 112, height: 32 },
  tagline: { color: colors.textMuted, fontSize: 9, marginTop: -2 },
  duty: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  dutyLabel: { fontSize: 13 },
});
