import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { colors, radii } from '@/constants/theme';

export type PaymentMethodId = 'cash' | 'card';

const METHODS: Array<{
  id: PaymentMethodId;
  title: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  enabled: boolean;
}> = [
  { id: 'cash', title: 'Cash', hint: 'Pay the rider when the order arrives', icon: 'cash-outline', enabled: true },
  {
    id: 'card',
    title: 'Card (test)',
    hint: 'Stripe test checkout opens after you place the order',
    icon: 'card-outline',
    enabled: true,
  },
];

export function PaymentSheet({
  visible,
  onClose,
  selectedId = 'cash',
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selectedId?: PaymentMethodId;
  onSelect?: (id: PaymentMethodId) => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Payment method"
      subtitle="Cash is default. Card (test) uses Stripe test mode after checkout — no real charge.">
      <View style={styles.list}>
        {METHODS.map((method) => {
          const active = method.id === selectedId;
          return (
            <Pressable
              key={method.id}
              disabled={!method.enabled}
              onPress={() => {
                onSelect?.(method.id);
                onClose();
              }}
              style={[styles.pay, !method.enabled && styles.payOff, active && styles.payOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: !method.enabled }}
              accessibilityLabel={`Select ${method.title}`}>
              <Ionicons name={method.icon} size={20} color={method.enabled ? colors.primary : colors.textMuted} />
              <View style={styles.copy}>
                <AppText weight="semibold" style={!method.enabled ? styles.muted : undefined}>
                  {method.title}
                </AppText>
                <AppText muted style={styles.hint}>
                  {method.hint}
                </AppText>
              </View>
              <View style={[styles.radio, active && styles.radioOn]}>
                {active ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
