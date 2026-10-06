import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import { openSystemAppSettings } from '@/lib/permissions';

type Props = {
  title?: string;
  body?: string;
  onRetry?: () => void;
};

/** Blocking card when location is required (rider duty / delivery). */
export function LocationPermissionGate({
  title = 'Location required',
  body = 'Turn on location for QuickBite in system settings, then try again. Duty and live delivery need GPS.',
  onRetry,
}: Props) {
  return (
    <View style={styles.card}>
      <Ionicons name="navigate-circle-outline" size={28} color={colors.primary} />
      <AppText weight="bold" style={styles.title}>
        {title}
      </AppText>
      <AppText muted style={styles.body}>
        {body}
      </AppText>
      <View style={styles.row}>
        <Pressable style={styles.btnPrimary} onPress={() => void openSystemAppSettings()}>
          <AppText weight="semibold" style={styles.btnPrimaryText}>
            Open settings
          </AppText>
        </Pressable>
        {onRetry ? (
          <Pressable style={styles.btnGhost} onPress={onRetry}>
            <AppText weight="semibold" style={styles.btnGhostText}>
              Try again
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 16, color: colors.text },
  body: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13 },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  btnGhostText: { color: colors.text, fontSize: 13 },
});
