import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { QuantityStepper } from '@/components/QuantityStepper';
import { VegMark } from '@/components/VegMark';
import { colors, formatInr, radii } from '@/constants/theme';
import type { MenuItem } from '@/types/models';

export function MenuItemRow({
  item,
  disabled,
  quantity,
  liked,
  onAdd,
  onIncrease,
  onDecrease,
  onToggleLike,
}: {
  item: MenuItem;
  disabled?: boolean;
  quantity: number;
  liked: boolean;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  onToggleLike: () => void;
}) {
  const unavailable = !item.is_available || disabled;
  return (
    <View style={[styles.row, unavailable && styles.dim]}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.fallback]}>
          <AppText weight="bold" style={styles.fallbackText}>
            {item.name.slice(0, 1).toUpperCase()}
          </AppText>
        </View>
      )}
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <AppText weight="semibold" numberOfLines={2} style={styles.name}>
            {item.name}
          </AppText>
          <Pressable
            onPress={onToggleLike}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={liked ? `Remove ${item.name} from favorites` : `Save ${item.name}`}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? colors.primary : colors.text} />
          </Pressable>
        </View>
        <View style={styles.diet}>
          <VegMark veg={item.is_veg} size={12} />
          <AppText muted style={styles.meta}>
            {item.is_veg ? 'Veg' : 'Non-veg'}
          </AppText>
        </View>
        {item.description ? (
          <AppText muted numberOfLines={2} style={styles.meta}>
            {item.description}
          </AppText>
        ) : null}
        <View style={styles.priceRow}>
          <AppText weight="bold" style={styles.price}>
            {formatInr(item.price)}
          </AppText>
          {quantity > 0 ? (
            <QuantityStepper quantity={quantity} label={item.name} onDecrease={onDecrease} onIncrease={onIncrease} />
          ) : (
            <Pressable
              onPress={onAdd}
              disabled={unavailable}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name}`}
              style={({ pressed }) => [styles.add, unavailable && styles.addOff, pressed && styles.pressed]}>
              <AppText weight="semibold" style={{ color: unavailable ? colors.textMuted : colors.primary }}>
                Add
              </AppText>
            </Pressable>
          )}
        </View>
        {!item.is_available ? (
          <AppText muted style={styles.meta}>
            Currently unavailable
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dim: { opacity: 0.55 },
  image: { width: 84, height: 84, borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: colors.primary, fontSize: 18 },
  copy: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { flex: 1, fontSize: 15 },
  diet: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontSize: 12, lineHeight: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  price: { fontSize: 14 },
  add: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  addOff: { borderColor: colors.border },
  pressed: { opacity: 0.8 },
});
