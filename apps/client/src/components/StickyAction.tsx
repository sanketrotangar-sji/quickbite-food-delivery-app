import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';

export function StickyAction({
  leading,
  label,
  onPress,
  loading,
  disabled,
}: {
  leading: string;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const blocked = disabled || loading;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable
        onPress={onPress}
        disabled={blocked}
        style={({ pressed }) => [styles.bar, pressed && !blocked && styles.pressed, blocked && styles.blocked]}>
        <AppText weight="semibold" style={styles.text}>
          {leading}
        </AppText>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <View style={styles.action}>
            <AppText weight="bold" style={styles.text}>
              {label}
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.white} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.background,
  },
  bar: {
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  text: { color: colors.white, fontSize: 15 },
  pressed: { opacity: 0.92 },
  blocked: { opacity: 0.45 },
});
