import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops', headerShown: true }} />
      <View style={styles.container}>
        <AppText weight="bold" style={{ fontSize: 20 }}>
          This screen doesn't exist.
        </AppText>
        <Link href="/" style={styles.link}>
          <AppText weight="medium" style={{ color: colors.primary }}>
            Go home
          </AppText>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  link: { marginTop: spacing.md },
});
