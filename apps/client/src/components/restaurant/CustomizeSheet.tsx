import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { colors, formatInr } from '@/constants/theme';
import { customizationFor, type DishChoice } from '@/lib/menu-customization';
import type { MenuItem } from '@/types/models';

export function CustomizeSheet({
  item,
  sizes,
  addons,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  sizes: DishChoice[];
  addons: DishChoice[];
  onClose: () => void;
  onAdd: (item: MenuItem) => void;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [sizeId, setSizeId] = useState(sizes[0]?.id ?? '');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    const options = item ? customizationFor(item) : null;
    setSizeId(options?.sizes[0]?.id ?? '');
    setPicked([]);
  }, [item]);

  return (
    <Modal visible={item != null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close customization" />
        {item ? (
          <View style={[styles.sheet, { maxHeight: height * 0.86, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <View style={styles.copy}>
                <AppText heading weight="semibold" style={styles.title}>
                  {item.name}
                </AppText>
                <AppText weight="bold" style={styles.price}>
                  {formatInr(item.price)}
                </AppText>
              </View>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {sizes.length > 0 ? (
                <View style={styles.group}>
                  <AppText weight="semibold">Choose one</AppText>
                  {sizes.map((choice) => {
                    const on = choice.id === sizeId;
                    return (
                      <Pressable key={choice.id} onPress={() => setSizeId(choice.id)} style={styles.option} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                        <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? colors.primary : colors.textMuted} />
                        <AppText weight="semibold" style={styles.optionLabel}>
                          {choice.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {addons.length > 0 ? (
                <View style={styles.group}>
                  <AppText weight="semibold">Add-ons</AppText>
                  {addons.map((choice) => {
                    const on = picked.includes(choice.id);
                    return (
                      <Pressable
                        key={choice.id}
                        onPress={() => setPicked((current) => (on ? current.filter((id) => id !== choice.id) : [...current, choice.id]))}
                        style={styles.option}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}>
                        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? colors.primary : colors.textMuted} />
                        <AppText weight="semibold" style={styles.optionLabel}>
                          {choice.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <AppText muted style={styles.note}>
                Prepared with the dish. The cart uses the menu price.
              </AppText>
            </ScrollView>
            <View style={styles.footer}>
              <Button
                label={`Add to Cart · ${formatInr(item.price)}`}
                onPress={() => {
                  onAdd(item);
                  onClose();
                }}
              />
            </View>
          </View>
        ) : null}
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
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 18 },
  price: { color: colors.primary, fontSize: 16 },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 16 },
  group: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  optionLabel: { fontSize: 14, flex: 1 },
  note: { fontSize: 12, lineHeight: 18 },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
});
