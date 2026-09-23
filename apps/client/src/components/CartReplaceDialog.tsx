import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { colors, radii, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  restaurantName: string;
  loading?: boolean;
  confirmLabel?: string;
  onKeep: () => void;
  onClearAndAdd: () => void;
};

export function CartReplaceDialog({
  visible,
  restaurantName,
  loading,
  confirmLabel = 'Clear cart & add',
  onKeep,
  onClearAndAdd,
}: Props) {
  const kitchen = restaurantName.trim() || 'another kitchen';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={loading ? undefined : onKeep}
          accessibilityLabel="Dismiss"
        />
        <View style={styles.card} accessibilityRole="alert">
          <View style={styles.iconWrap}>
            <Ionicons name="bag-handle-outline" size={28} color={colors.primary} />
          </View>

          <AppText heading weight="semibold" style={styles.title}>
            Start a new cart?
          </AppText>

          <AppText muted style={styles.body}>
            {`Your cart already has items from ${kitchen}. Clear it to add dishes from a different restaurant.`}
          </AppText>

          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              onPress={onClearAndAdd}
              loading={loading}
              style={styles.action}
            />
            <Button
              label="Keep current cart"
              variant="ghost"
              onPress={onKeep}
              disabled={loading}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
  action: {
    width: '100%',
  },
});
