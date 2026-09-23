import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { colors, radii } from '@/constants/theme';
import { DEFAULT_EXPLORE_FILTERS, type ExploreFilters } from '@/lib/explore-filters';
import type { DietFilter } from '@/lib/home-mock';

type Option<T extends string | number> = { value: T; label: string };

const DIETS: Option<DietFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'veg', label: 'Veg' },
  { value: 'nonveg', label: 'Non-veg' },
];

const RATINGS: Option<number>[] = [
  { value: 0, label: 'Any' },
  { value: 4, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
];

const TIMES: Option<number>[] = [
  { value: 0, label: 'Any' },
  { value: 25, label: 'Under 25 min' },
  { value: 30, label: 'Under 30 min' },
  { value: 35, label: 'Under 35 min' },
];

const PRICES: Option<number>[] = [
  { value: 0, label: 'Any' },
  { value: 200, label: 'Under ₹200' },
  { value: 400, label: 'Under ₹400' },
];

const OFFERS: Option<number>[] = [
  { value: 0, label: 'Any' },
  { value: 1, label: 'Has offer' },
];

export function FilterSheet({
  visible,
  value,
  cuisines,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: ExploreFilters;
  cuisines: { id: string; label: string }[];
  onClose: () => void;
  onApply: (next: ExploreFilters) => void;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [value, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />
        <View style={[styles.sheet, { maxHeight: height * 0.86, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <AppText heading weight="semibold" style={styles.title}>
              Filters
            </AppText>
            <Pressable onPress={() => setDraft(DEFAULT_EXPLORE_FILTERS)} hitSlop={8}>
              <AppText weight="semibold" style={styles.clear}>
                Clear
              </AppText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {cuisines.length > 0 ? (
              <View style={styles.group}>
                <AppText weight="semibold">Cuisine</AppText>
                <View style={styles.options}>
                  {cuisines.map((cuisine) => {
                    const on = cuisine.id === draft.cuisineId;
                    return (
                      <Pressable
                        key={cuisine.id}
                        onPress={() => setDraft((current) => ({ ...current, cuisineId: cuisine.id }))}
                        style={[styles.chip, on && styles.chipOn]}>
                        <AppText weight="semibold" style={[styles.chipText, on && styles.chipTextOn]}>
                          {cuisine.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <FilterGroup label="Veg / Non-veg" options={DIETS} selected={draft.diet} onSelect={(diet) => setDraft((current) => ({ ...current, diet }))} />
            <FilterGroup
              label="Rating"
              options={RATINGS}
              selected={draft.minRating}
              onSelect={(minRating) => setDraft((current) => ({ ...current, minRating }))}
            />
            <FilterGroup
              label="Delivery time"
              options={TIMES}
              selected={draft.maxMinutes}
              onSelect={(maxMinutes) => setDraft((current) => ({ ...current, maxMinutes }))}
            />
            <FilterGroup
              label="Price"
              options={PRICES}
              selected={draft.maxPrice}
              onSelect={(maxPrice) => setDraft((current) => ({ ...current, maxPrice }))}
            />
            <FilterGroup
              label="Offers"
              options={OFFERS}
              selected={draft.offersOnly ? 1 : 0}
              onSelect={(offers) => setDraft((current) => ({ ...current, offersOnly: offers === 1 }))}
            />
          </ScrollView>
          <View style={styles.footer}>
            <Button
              label="Show results"
              onPress={() => {
                onApply(draft);
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FilterGroup<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      <AppText weight="semibold">{label}</AppText>
      <View style={styles.options}>
        {options.map((option) => {
          const on = option.value === selected;
          return (
            <Pressable key={String(option.value)} onPress={() => onSelect(option.value)} style={[styles.chip, on && styles.chipOn]}>
              {option.value === 'veg' ? <Ionicons name="leaf" size={12} color={on ? colors.white : '#2E9B57'} /> : null}
              <AppText weight="semibold" style={[styles.chipText, on && styles.chipTextOn]}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  title: { fontSize: 18 },
  clear: { color: colors.primary, fontSize: 13 },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 16 },
  group: { gap: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextOn: { color: colors.white },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
});
