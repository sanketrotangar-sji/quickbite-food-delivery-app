import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AddressForm } from '@/components/address/AddressForm';
import { AppText } from '@/components/AppText';
import { colors, screenTopGap } from '@/constants/theme';
import type { AddressDraft, SavedAddress } from '@/lib/addresses';

export function AddressEditorModal({
  visible,
  initial,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  initial?: SavedAddress | null;
  onClose: () => void;
  onSubmit: (draft: AddressDraft) => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const editing = Boolean(initial);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + screenTopGap, paddingBottom: insets.bottom }]}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.back} accessibilityLabel="Close">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <AppText heading weight="semibold" style={styles.title}>
            {editing ? 'Edit address' : 'New address'}
          </AppText>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          {visible ? (
            <AddressForm
              key={initial?.id ?? 'new'}
              initial={initial}
              submitLabel={editing ? 'Save changes' : 'Save address'}
              onSubmit={onSubmit}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 8 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18 },
  body: { padding: 16, paddingBottom: 32 },
});
