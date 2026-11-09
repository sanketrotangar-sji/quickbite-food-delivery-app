import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radii, spacing } from '@/constants/theme';
import { useAreaSearch, useLocateMe } from '@/features/location/hooks';
import { MARGAO_FALLBACK, useLocationStore } from '@/features/location/store';
import { openSystemAppSettings } from '@/lib/permissions';

function goHome() {
  router.replace('/(customer)/(tabs)');
}

export function LocationScreen() {
  const insets = useSafeAreaInsets();
  const { locate, locating } = useLocateMe();
  const { search, searching } = useAreaSearch();
  const applyFallback = useLocationStore((s) => s.applyFallback);
  const [blocked, setBlocked] = useState(false);
  const [query, setQuery] = useState('');

  async function onLocate() {
    const result = await locate();
    if (result.status === 'ok') return goHome();
    if (result.status === 'denied') {
      setBlocked(!result.canAskAgain);
      toast('Location is off', { description: 'Search your area below or continue with Margao.' });
      return;
    }
    toast.error('Could not find you', { description: result.message });
  }

  async function onSearch() {
    if (await search(query)) return goHome();
    toast.error('Area not found', { description: 'Try a nearby landmark or locality name.' });
  }

  function onSkip() {
    applyFallback();
    goHome();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="location" size={40} color={colors.primary} />
        </View>
        <AppText heading weight="bold" style={styles.title}>
          Where should we deliver?
        </AppText>
        <AppText muted style={styles.body}>
          We use your location to show kitchens that can reach you and accurate delivery times.
        </AppText>
      </View>

      <View style={styles.actions}>
        {blocked ? (
          <Button label="Open settings to allow location" onPress={() => void openSystemAppSettings()} />
        ) : (
          <Button label="Use current location" onPress={() => void onLocate()} loading={locating} />
        )}

        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <TextField
              label="Or search your area"
              placeholder="e.g. Colva, Fatorda, Panjim"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={() => void onSearch()}
            />
          </View>
        </View>
        <Button
          label="Search area"
          variant="ghost"
          onPress={() => void onSearch()}
          loading={searching}
          disabled={!query.trim()}
        />

        <Button label={`Skip — browse ${MARGAO_FALLBACK.label}`} variant="ghost" onPress={onSkip} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 22, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  actions: { gap: spacing.sm },
  searchRow: { marginTop: spacing.sm },
  searchField: { flex: 1 },
});
