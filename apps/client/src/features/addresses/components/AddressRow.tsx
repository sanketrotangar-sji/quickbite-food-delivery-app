import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import { addressIcon, displayNickname, type SavedAddress } from '@/lib/addresses';

export function AddressRow({
  address,
  selected,
  onPress,
  onEdit,
  onRemove,
}: {
  address: SavedAddress;
  selected: boolean;
  onPress: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, selected && styles.rowOn]}>
      <View style={styles.icon}>
        <Ionicons name={addressIcon(address.label)} size={18} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <AppText weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
            {displayNickname(address)}
          </AppText>
          {selected ? (
            <View style={styles.pill}>
              <AppText weight="semibold" style={styles.pillText}>
                Delivering here
              </AppText>
            </View>
          ) : (
            <Ionicons name="ellipse-outline" size={18} color={colors.border} />
          )}
        </View>
        <AppText muted style={styles.line} numberOfLines={2}>
          {address.line}
        </AppText>
        <AppText muted style={styles.line} numberOfLines={1}>
          {address.area}
          {address.landmark.trim() ? ` · ${address.landmark.trim()}` : ''}
        </AppText>
        {onEdit || onRemove ? (
          <View style={styles.actions}>
            {onEdit ? (
              <Pressable onPress={onEdit} hitSlop={6}>
                <AppText weight="semibold" style={styles.action}>
                  Edit
                </AppText>
              </Pressable>
            ) : null}
            {onRemove ? (
              <Pressable onPress={onRemove} hitSlop={6}>
                <AppText weight="semibold" style={styles.remove}>
                  Remove
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  copy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { color: colors.white, fontSize: 10 },
  line: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  action: { color: colors.primary, fontSize: 13 },
  remove: { color: colors.danger, fontSize: 13 },
});
