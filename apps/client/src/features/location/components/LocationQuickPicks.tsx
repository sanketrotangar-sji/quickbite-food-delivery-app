import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { toast } from 'sonner-native';

import { AppText } from '@/components/AppText';
import { colors, fonts, radii } from '@/constants/theme';
import { useAreaSearch, useLocateMe } from '@/features/location/hooks';
import { openSystemAppSettings } from '@/lib/permissions';

/** GPS + area search rows shown above saved addresses in the delivery sheet. */
export function LocationQuickPicks({ onPicked }: { onPicked: () => void }) {
  const { locate, locating } = useLocateMe();
  const { search, searching } = useAreaSearch();
  const [query, setQuery] = useState('');

  async function onLocate() {
    const result = await locate();
    if (result.status === 'ok') return onPicked();
    if (result.status === 'denied') {
      if (result.canAskAgain) {
        toast('Location is off', { description: 'Search your area instead.' });
      } else {
        toast('Location is blocked', {
          description: 'Allow it in Settings to use your current location.',
          action: { label: 'Settings', onClick: () => void openSystemAppSettings() },
        });
      }
      return;
    }
    toast.error('Could not find you', { description: result.message });
  }

  async function onSearch() {
    if (await search(query)) {
      setQuery('');
      return onPicked();
    }
    toast.error('Area not found', { description: 'Try a nearby landmark or locality name.' });
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => void onLocate()} style={styles.row} accessibilityRole="button">
        {locating ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons name="locate" size={18} color={colors.primary} />
        )}
        <AppText weight="semibold" style={styles.rowText}>
          Use current location
        </AppText>
      </Pressable>
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search area, e.g. Colva"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={() => void onSearch()}
          style={styles.input}
        />
        {searching ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  rowText: { color: colors.primary, fontSize: 14 },
  search: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text, paddingVertical: 8 },
});
