import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { ORDER_STATUS_META } from '@/constants/orderStatus';
import { colors, fonts } from '@/constants/theme';
import { useActiveOrder } from '@/hooks/useOrderTracking';

export const ACTIVE_ORDER_BAR_HEIGHT = 64;

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index: { on: 'home', off: 'home-outline' },
  picks: { on: 'search', off: 'search-outline' },
  reorder: { on: 'bag-handle', off: 'bag-handle-outline' },
  assistant: { on: 'chatbubble-ellipses', off: 'chatbubble-ellipses-outline' },
  settings: { on: 'person', off: 'person-outline' },
};

export function CustomerTabBar({
  state,
  descriptors,
  navigation,
}: {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  descriptors: Record<string, { options?: { tabBarLabel?: unknown; title?: string } }>;
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string, params?: object) => void;
  };
}) {
  const insets = useSafeAreaInsets();
  const { activeOrder } = useActiveOrder();
  const activeRoute = state.routes[state.index]?.name;
  const showActiveOrder = !!activeOrder && (activeRoute === 'index' || activeRoute === 'picks' || activeRoute === 'reorder');

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {showActiveOrder ? (
        <Pressable
          onPress={() => router.push(`/(customer)/orders/${activeOrder.id}`)}
          style={({ pressed }) => [styles.activeOrder, pressed && styles.pressed]}>
          <View style={styles.activeIcon}>
            <Ionicons name={activeOrder.status === 'out_for_delivery' ? 'bicycle' : 'bag-handle'} size={18} color={colors.white} />
          </View>
          <View style={styles.activeCopy}>
            <AppText weight="bold" numberOfLines={1} style={styles.activeTitle}>
              {ORDER_STATUS_META[activeOrder.status].label} · {activeOrder.restaurants?.name ?? 'Your order'}
            </AppText>
            <AppText numberOfLines={1} style={styles.activeMeta}>
              {activeOrder.eta_minutes != null ? `${activeOrder.eta_minutes} min ETA` : ORDER_STATUS_META[activeOrder.status].customerHint}
            </AppText>
          </View>
          <AppText weight="bold" style={styles.track}>Track</AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options ?? {};
          const rawLabel = options.tabBarLabel;
          const label = typeof rawLabel === 'string' ? rawLabel : (options.title ?? route.name);
          const icons = ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline' };
          const color = focused ? colors.primary : colors.textMuted;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              style={styles.item}>
              <Ionicons name={focused ? icons.on : icons.off} size={22} color={color} />
              <AppText weight={focused ? 'semibold' : 'medium'} style={[styles.label, { color }]}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  activeOrder: {
    minHeight: ACTIVE_ORDER_BAR_HEIGHT,
    marginHorizontal: 12,
    marginTop: -ACTIVE_ORDER_BAR_HEIGHT - 6,
    marginBottom: 6,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.forestMuted,
  },
  activeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  activeCopy: { flex: 1, gap: 2 },
  activeTitle: { color: colors.white, fontSize: 12 },
  activeMeta: { color: colors.forestForeground, fontSize: 10 },
  track: { color: colors.primary, fontSize: 12 },
  pressed: { opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 46 },
  label: { fontFamily: fonts.medium, fontSize: 11 },
});
