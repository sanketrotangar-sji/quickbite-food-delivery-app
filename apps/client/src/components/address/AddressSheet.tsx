import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddressForm } from '@/components/address/AddressForm';
import { AddressRow } from '@/components/address/AddressRow';
import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import { useAddresses } from '@/hooks/useAddresses';

export function AddressSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { addresses, selectedId, error, select, add } = useAddresses();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!visible) setAdding(false);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close address list" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap}>
          <View style={[styles.sheet, { maxHeight: height * 0.86, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.handle} />
            <View style={styles.head}>
              {adding ? (
                <Pressable onPress={() => setAdding(false)} hitSlop={8} style={styles.back}>
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }}>
                <AppText heading weight="semibold" style={styles.title}>
                  {adding ? 'New address' : 'Deliver to'}
                </AppText>
                {adding ? null : (
                  <AppText muted style={styles.caption}>
                    Choose where this order should land.
                  </AppText>
                )}
              </View>
            </View>
            <ScrollView
              style={{ maxHeight: height * 0.7 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}>
              {adding ? (
                <AddressForm
                  submitLabel="Save address"
                  onSubmit={async (draft) => {
                    await add(draft);
                    onClose();
                  }}
                />
              ) : (
                <>
                  {error ? <AppText style={styles.error}>{error}</AppText> : null}
                  {addresses.length === 0 ? (
                    <AppText muted>No saved addresses yet. Add home, work, or anywhere else you order from.</AppText>
                  ) : (
                    addresses.map((address) => (
                      <AddressRow
                        key={address.id}
                        address={address}
                        selected={address.id === selectedId}
                        onPress={() => {
                          void select(address.id).then(onClose).catch(() => {});
                        }}
                      />
                    ))
                  )}
                  <Pressable onPress={() => setAdding(true)} style={styles.add}>
                    <Ionicons name="add" size={18} color={colors.primary} />
                    <AppText weight="semibold" style={styles.addText}>
                      Add new address
                    </AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push('/(customer)/addresses');
                    }}
                    style={styles.manage}>
                    <AppText weight="semibold" style={styles.manageText}>
                      Manage addresses
                    </AppText>
                    <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheetWrap: { zIndex: 2 },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, marginBottom: 8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18 },
  caption: { fontSize: 12, marginTop: 2 },
  body: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  add: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
  },
  addText: { color: colors.primary },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  manage: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  manageText: { color: colors.secondary },
});
