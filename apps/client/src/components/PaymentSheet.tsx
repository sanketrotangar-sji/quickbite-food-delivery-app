import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';

const METHODS = [
  { id: 'cash', title: 'Cash', hint: 'Pay the rider when the order arrives', icon: 'cash-outline' as const, enabled: true },
  { id: 'upi', title: 'UPI', hint: 'Not open yet', icon: 'phone-portrait-outline' as const, enabled: false },
  { id: 'card', title: 'Card', hint: 'Not open yet', icon: 'card-outline' as const, enabled: false },
  { id: 'wallet', title: 'Wallets', hint: 'Not open yet', icon: 'wallet-outline' as const, enabled: false },
];

export function PaymentSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close payment methods" />
        <View style={[styles.sheet, { maxHeight: height * 0.72, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <AppText heading weight="semibold" style={styles.title}>
            Payment method
          </AppText>
          <AppText muted style={styles.caption}>
            Cash is available for this order.
          </AppText>
          <View style={styles.list}>
            {METHODS.map((method) => {
              const active = method.id === 'cash';
              return (
                <View key={method.id} style={[styles.pay, !method.enabled && styles.payOff, active && styles.payOn]}>
                  <Ionicons name={method.icon} size={20} color={method.enabled ? colors.primary : colors.textMuted} />
                  <View style={styles.copy}>
                    <AppText weight="semibold" style={!method.enabled ? styles.muted : undefined}>
                      {method.title}
                    </AppText>
                    <AppText muted style={styles.hint}>
                      {method.hint}
                    </AppText>
                  </View>
                  <View style={[styles.radio, active && styles.radioOn]}>{active ? <View style={styles.radioDot} /> : null}</View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  title: { fontSize: 18 },
  caption: { fontSize: 13 },
  list: { gap: 8, marginTop: 4 },
  pay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  payOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  payOff: { opacity: 0.55 },
  copy: { flex: 1, gap: 2 },
  muted: { color: colors.textMuted },
  hint: { fontSize: 13 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
