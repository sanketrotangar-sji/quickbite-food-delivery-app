import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddressEditorModal } from '@/components/address/AddressEditorModal';
import { AddressRow } from '@/components/address/AddressRow';
import { AppText } from '@/components/AppText';
import { FlowHeader } from '@/components/FlowHeader';
import { Screen } from '@/components/Screen';
import { colors, radii } from '@/constants/theme';
import { useAddresses } from '@/hooks/useAddresses';
import type { SavedAddress } from '@/lib/addresses';

export function AddressesScreen() {
  const params = useLocalSearchParams<{ add?: string }>();
  const insets = useSafeAreaInsets();
  const { addresses, selectedId, error, select, add, update, remove } = useAddresses();
  const [editor, setEditor] = useState<SavedAddress | 'new' | null>(null);
  const openedAdd = useRef(false);

  useEffect(() => {
    if (params.add === '1' && !openedAdd.current) {
      openedAdd.current = true;
      setEditor('new');
    }
  }, [params.add]);

  const initial = editor && editor !== 'new' ? editor : null;

  return (
    <Screen>
      <StatusBar style="dark" />
      <FlowHeader title="Saved addresses" subtitle="Home, work, and anywhere else you order" />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        {addresses.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={26} color={colors.primary} />
            </View>
            <AppText heading style={styles.emptyTitle}>
              No addresses yet
            </AppText>
            <AppText muted style={styles.emptyCopy}>
              Save a few places. The one you pick is what the home screen delivers to.
            </AppText>
          </View>
        ) : (
          addresses.map((address) => (
            <AddressRow
              key={address.id}
              address={address}
              selected={address.id === selectedId}
              onPress={() => void select(address.id).catch(() => {})}
              onEdit={() => setEditor(address)}
              onRemove={() =>
                Alert.alert('Remove address?', displayLine(address), [
                  { text: 'Keep' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => void remove(address.id).catch(() => {}),
                  },
                ])
              }
            />
          ))
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable onPress={() => setEditor('new')} style={styles.add}>
          <Ionicons name="add" size={18} color={colors.white} />
          <AppText weight="bold" style={styles.addText}>
            Add address
          </AppText>
        </Pressable>
      </View>
      <AddressEditorModal
        visible={editor !== null}
        initial={initial}
        onClose={() => setEditor(null)}
        onSubmit={async (draft) => {
          if (editor && editor !== 'new') await update(editor.id, draft);
          else await add(draft);
          setEditor(null);
        }}
      />
    </Screen>
  );
}

function displayLine(address: SavedAddress) {
  return `${address.nickname} · ${address.line}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 8, paddingHorizontal: 12 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 22 },
  emptyCopy: { textAlign: 'center', lineHeight: 20 },
  footer: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.background },
  add: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addText: { color: colors.white },
});
