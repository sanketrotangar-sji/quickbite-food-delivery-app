import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';

const TILES = [
  { id: 'offers', title: 'Offers', subtitle: 'Best deals for you', icon: 'pricetag' as const, tint: '#F15A24', wash: '#FFE8DC' },
  { id: 'healthy', title: 'Healthy', subtitle: 'Nutritious choices', icon: 'leaf' as const, tint: '#2E9B57', wash: '#E5F6EC' },
  { id: 'quick', title: 'Quick', subtitle: 'Under 30 mins', icon: 'flash' as const, tint: '#7A4DDB', wash: '#F3E8FF' },
  { id: 'top', title: 'Top Rated', subtitle: 'Loved by locals', icon: 'star' as const, tint: '#E0A106', wash: '#FFF4D6' },
] as const;

export type ShortcutId = (typeof TILES)[number]['id'];

export function ShortcutRow({ selected, onSelect }: { selected: ShortcutId | null; onSelect: (id: ShortcutId) => void }) {
  return (
    <View style={styles.row}>
      {TILES.map((tile) => {
        const on = selected === tile.id;
        return (
          <Pressable key={tile.id} onPress={() => onSelect(tile.id)} style={[styles.tile, on && styles.tileOn]}>
            <View style={[styles.icon, { backgroundColor: tile.wash }]}>
              <Ionicons name={tile.icon} size={13} color={tile.tint} />
            </View>
            <AppText weight="bold" numberOfLines={1} style={styles.title}>
              {tile.title}
            </AppText>
            <AppText muted numberOfLines={1} style={styles.subtitle}>
              {tile.subtitle}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
  },
  tileOn: { borderColor: colors.primary },
  icon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 11, textAlign: 'center' },
  subtitle: { fontSize: 8, textAlign: 'center', lineHeight: 10 },
});
