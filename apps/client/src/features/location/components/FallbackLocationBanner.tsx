import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import { AddressSheet } from '@/features/addresses/components/AddressSheet';
import { useDeliveryPoint } from '@/features/location/hooks';
import { MARGAO_FALLBACK } from '@/features/location/store';

/** Shown while browsing on the default city instead of the user's own location. */
export function FallbackLocationBanner() {
  const { isFallback } = useDeliveryPoint();
  const [open, setOpen] = useState(false);
  if (!isFallback) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="navigate-circle-outline" size={18} color={colors.warning} />
      <AppText style={styles.text} numberOfLines={2}>
        Showing kitchens near {MARGAO_FALLBACK.label}. Set your location for accurate delivery times.
      </AppText>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button">
        <AppText weight="bold" style={styles.action}>
          Change
        </AppText>
      </Pressable>
      <AddressSheet visible={open} onClose={() => setOpen(false)} allowLocationPicks />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
  },
  text: { flex: 1, fontSize: 12, color: colors.text },
  action: { fontSize: 13, color: colors.primary },
});
