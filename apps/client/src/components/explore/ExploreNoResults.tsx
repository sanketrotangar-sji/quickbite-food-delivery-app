import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { CategoryChips, type CuisineChip } from '@/components/home/CategoryChips';

export function ExploreNoResults({
  suggestions,
  onSuggest,
  onClear,
}: {
  suggestions: CuisineChip[];
  onSuggest: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <View accessibilityLiveRegion="polite">
      <EmptyState
        icon="search-outline"
        title="Nothing matches"
        body="Try another cuisine, or clear the filters to see kitchens near you."
        actionLabel="Clear filters"
        onAction={onClear}
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          <AppText weight="semibold" style={styles.label}>
            Try a different cuisine
          </AppText>
          <CategoryChips chips={suggestions} selectedId="" onSelect={onSuggest} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestions: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  label: { fontSize: 13 },
});
