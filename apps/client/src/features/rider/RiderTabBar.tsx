import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, fonts } from '@/constants/theme';

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index: { on: 'home', off: 'home-outline' },
  orders: { on: 'bag-handle', off: 'bag-handle-outline' },
  earnings: { on: 'wallet', off: 'wallet-outline' },
  profile: { on: 'person', off: 'person-outline' },
};

export function RiderTabBar({
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

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
    paddingTop: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 46 },
  label: { fontFamily: fonts.medium, fontSize: 11 },
});
