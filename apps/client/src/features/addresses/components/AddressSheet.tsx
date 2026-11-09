import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { colors, radii } from '@/constants/theme';
import { AddressForm } from '@/features/addresses/components/AddressForm';
import { AddressRow } from '@/features/addresses/components/AddressRow';
import { useAddresses } from '@/features/addresses/hooks';
import { LocationQuickPicks } from '@/features/location/components/LocationQuickPicks';
import { useAuth } from '@/hooks/useAuth';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Browse screens also let people pick GPS or a searched area without saving an address. */
  allowLocationPicks?: boolean;
};

export function AddressSheet({ visible, onClose, allowLocationPicks = false }: Props) {
  const { session } = useAuth();
  const { addresses, selectedId, error, select, add } = useAddresses();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!visible) setAdding(false);
  }, [visible]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={adding ? 'New address' : 'Deliver to'}
      subtitle={adding ? undefined : 'Choose where this order should land.'}
      headerLeft={
        adding ? (
          <Pressable onPress={() => setAdding(false)} hitSlop={8} style={styles.back} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
        ) : null
      }>
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
          {allowLocationPicks ? <LocationQuickPicks onPicked={onClose} /> : null}
          {error ? (
            <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </AppText>
          ) : null}
          {!session ? (
            <Pressable
              onPress={() => {
                onClose();
                router.push({ pathname: '/(auth)/login', params: { message: 'Sign in to save delivery addresses.' } });
              }}
              style={styles.manage}>
              <AppText weight="semibold" style={styles.manageText}>
                Sign in to use saved addresses
              </AppText>
              <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
            </Pressable>
          ) : addresses.length === 0 ? (
            <AppText muted>No saved addresses yet. Add home, work, or anywhere else you order from.</AppText>
          ) : (
            addresses.map((address) => (
              <AddressRow
                key={address.id}
                address={address}
                selected={address.id === selectedId}
                onPress={() => {
                  void select(address.id)
                    .then(onClose)
                    .catch(() => {});
                }}
              />
            ))
          )}
          {session ? (
            <>
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
          ) : null}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
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
  manage: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  manageText: { color: colors.secondary },
});
