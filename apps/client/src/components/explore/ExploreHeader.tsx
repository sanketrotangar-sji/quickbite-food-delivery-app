import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AddressSheet } from '@/components/address/AddressSheet';
import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useAddresses } from '@/hooks/useAddresses';

export function ExploreHeader() {
  const { hydrated, selected } = useAddresses();
  const [addressOpen, setAddressOpen] = useState(false);
  const place = !hydrated ? '…' : selected?.area || (selected ? selected.nickname : 'Add address');

  return (
    <View style={styles.row}>
      <AppText heading weight="semibold" style={styles.title}>
        Explore
      </AppText>
      <Pressable onPress={() => setAddressOpen(true)} style={styles.location} accessibilityRole="button" accessibilityLabel="Choose delivery address">
        <View style={styles.locationCopy}>
          <AppText style={styles.locationLabel}>Delivering to</AppText>
          <View style={styles.locationRow}>
            <AppText weight="bold" numberOfLines={1} style={styles.locationValue}>
              {place}
            </AppText>
            <Ionicons name="chevron-down" size={14} color={colors.text} />
          </View>
        </View>
      </Pressable>
      <AddressSheet visible={addressOpen} onClose={() => setAddressOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  title: { fontSize: 22 },
  location: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  locationCopy: { flexShrink: 1, alignItems: 'flex-end' },
  locationLabel: { color: colors.textMuted, fontSize: 10, textAlign: 'right' },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  locationValue: { color: colors.text, fontSize: 13, flexShrink: 1, textAlign: 'right' },
});
