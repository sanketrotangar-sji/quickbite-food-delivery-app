import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';

export function FlowHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(customer)/(tabs)');
        }}
        hitSlop={10}
        style={styles.back}
        accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <View style={styles.copy}>
        <AppText heading weight="semibold" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText muted numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 1 },
  title: { fontSize: 18 },
  subtitle: { fontSize: 12 },
});
