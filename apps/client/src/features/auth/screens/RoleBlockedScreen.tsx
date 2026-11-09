import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';

export function RoleBlockedScreen({ title, body }: { title: string; body: string }) {
  return (
    <Screen>
      <View style={styles.box}>
        <AppText weight="bold" style={styles.title}>
          {title}
        </AppText>
        <AppText muted style={{ textAlign: 'center' }}>
          {body}
        </AppText>
        <Button label="Back to home" onPress={() => router.replace('/(customer)/(tabs)')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  title: { fontSize: 24, textAlign: 'center', color: colors.secondary },
});
