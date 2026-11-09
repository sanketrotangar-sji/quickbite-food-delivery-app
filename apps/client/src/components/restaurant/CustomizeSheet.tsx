import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { colors, formatInr } from '@/constants/theme';
import { customizationFor, type DishChoice } from '@/lib/menu-customization';
import type { DetailMenuItem as MenuItem } from '@quickbite/api/mobile/catalog';

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
  // Keep the last dish while the sheet animates closed.
  const [shown, setShown] = useState<MenuItem | null>(item);
  const [sizeId, setSizeId] = useState(sizes[0]?.id ?? '');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (item) setShown(item);
    const options = item ? customizationFor(item) : null;
    setSizeId(options?.sizes[0]?.id ?? '');
    setPicked([]);
  }, [item]);

  return (
    <Sheet
      visible={item != null}
      onClose={onClose}
      title={shown?.name ?? ''}
      subtitle={shown ? formatInr(shown.price) : undefined}
      headerRight={
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      }
      footer={
        shown ? (
          <Button
            label={`Add to Cart · ${formatInr(shown.price)}`}
            onPress={() => {
              onAdd(shown);
              onClose();
            }}
          />
        ) : null
      }>
      <View style={styles.body}>
        {sizes.length > 0 ? (
          <View style={styles.group}>
            <AppText weight="semibold">Choose one</AppText>
            {sizes.map((choice) => {
              const on = choice.id === sizeId;
              return (
                <Pressable
                  key={choice.id}
                  onPress={() => setSizeId(choice.id)}
                  style={styles.option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}>
                  <Ionicons
                    name={on ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={on ? colors.primary : colors.textMuted}
                  />
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
                  onPress={() =>
                    setPicked((current) => (on ? current.filter((id) => id !== choice.id) : [...current, choice.id]))
                  }
                  style={styles.option}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={on ? colors.primary : colors.textMuted}
                  />
                  <AppText variant="body" weight="semibold" style={styles.optionLabel}>
                    {choice.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <AppText variant="meta" muted>
          Prepared with the dish. The cart uses the menu price.
        </AppText>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 12, gap: 16 },
  group: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  optionLabel: { flex: 1 },
});
