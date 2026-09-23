import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { HomeSearch } from '@/components/home/HomeSearch';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { SectionHeader } from '@/components/SectionHeader';
import { colors } from '@/constants/theme';
import type { HomeCategory, HomeDish, HomePlace } from '@/lib/home-mock';
import type { CuisineChip } from '@/components/home/CategoryChips';

import { CuisineCard } from './CuisineCard';
import { ExploreDishGrid } from './ExploreDishGrid';
import { ExploreNoResults } from './ExploreNoResults';
import { ExploreRestaurantCard } from './ExploreRestaurantCard';

export const EXPLORE_SEARCH_PLACEHOLDER = 'Search dishes, restaurants or cuisines...';

export function ExploreSearchMode({
  query,
  onChangeQuery,
  onCancel,
  cravings,
  selectedCuisineId,
  onSelectCuisine,
  places,
  dishes,
  cardWidth,
  priceLabelFor,
  isLiked,
  onToggleLike,
  onAdd,
  onOpenRestaurant,
  loading,
  failed,
  errorMessage,
  onRetry,
  catalogEmpty,
  suggestions,
  onSuggest,
  onClear,
}: {
  query: string;
  onChangeQuery: (text: string) => void;
  onCancel: () => void;
  cravings: HomeCategory[];
  selectedCuisineId: string;
  onSelectCuisine: (id: string) => void;
  places: HomePlace[];
  dishes: HomeDish[];
  cardWidth: number;
  priceLabelFor: (placeId: string) => string;
  isLiked: (id: string) => boolean;
  onToggleLike: (id: string) => void;
  onAdd: (dish: HomeDish) => void;
  onOpenRestaurant: (id: string) => void;
  loading: boolean;
  failed: boolean;
  errorMessage: string;
  onRetry: () => void;
  catalogEmpty: boolean;
  suggestions: CuisineChip[];
  onSuggest: (id: string) => void;
  onClear: () => void;
}) {
  const typed = query.trim().length > 0;
  const restaurants = typed ? places.slice(0, 8) : places.slice(0, 4);
  const showEmpty = !loading && !failed && !catalogEmpty && restaurants.length === 0 && (!typed || dishes.length === 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <View style={styles.searchFlex}>
          <HomeSearch value={query} onChangeText={onChangeQuery} autoFocus placeholder={EXPLORE_SEARCH_PLACEHOLDER} />
        </View>
        <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
          <AppText weight="semibold" style={styles.cancel}>
            Cancel
          </AppText>
        </Pressable>
      </View>

      {!typed && cravings.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.block}>
            <SectionHeader title="What are you craving?" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {cravings.map((category) => (
              <CuisineCard
                key={category.id}
                category={category}
                selected={category.id === selectedCuisineId}
                onPress={() => onSelectCuisine(category.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.block} accessibilityLabel="Loading kitchens" accessibilityState={{ busy: true }}>
          <LoadingSkeleton variant="feature" rows={2} />
        </View>
      ) : null}

      {failed ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load kitchens" body={errorMessage} actionLabel="Try again" onAction={onRetry} />
      ) : null}

      {catalogEmpty ? (
        <EmptyState
          icon="restaurant-outline"
          title="Nothing to explore yet"
          body="Kitchens and dishes will show up here once they're available."
        />
      ) : null}

      {showEmpty ? <ExploreNoResults suggestions={suggestions} onSuggest={onSuggest} onClear={onClear} /> : null}

      {!loading && !failed && restaurants.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.block}>
            <SectionHeader title="Restaurants near you" />
            <View style={styles.list}>
              {restaurants.map((place) => (
                <ExploreRestaurantCard
                  key={place.id}
                  place={place}
                  priceLabel={priceLabelFor(place.id)}
                  liked={isLiked(place.id)}
                  onToggleLike={() => onToggleLike(place.id)}
                  onPress={() => onOpenRestaurant(place.id)}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {typed && !loading && !failed && dishes.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.block}>
            <SectionHeader title="Dishes" />
            <ExploreDishGrid
              dishes={dishes}
              cardWidth={cardWidth}
              isLiked={isLiked}
              onToggleLike={onToggleLike}
              onAdd={onAdd}
              onOpen={onOpenRestaurant}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  searchFlex: { flex: 1 },
  cancel: { color: colors.primary, fontSize: 13 },
  section: { gap: 0 },
  block: { paddingHorizontal: 16, gap: 0 },
  rail: { gap: 8, paddingLeft: 16, paddingRight: 16 },
  list: { gap: 12 },
});
