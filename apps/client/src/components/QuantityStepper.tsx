import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';

export function QuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
  label,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  label: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onDecrease}
        hitSlop={6}
        style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
        accessibilityLabel={quantity === 1 ? `Remove ${label}` : `Remove one ${label}`}>
        <Ionicons name={quantity === 1 ? 'trash-outline' : 'remove'} size={16} color={colors.primary} />
      </Pressable>
      <AppText weight="bold" style={styles.qty}>
        {quantity}
      </AppText>
      <Pressable
        onPress={onIncrease}
        hitSlop={6}
        style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
        accessibilityLabel={`Add one ${label}`}>
        <Ionicons name="add" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  stepBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  qty: { minWidth: 16, textAlign: 'center', color: colors.primary, fontSize: 14 },
});
