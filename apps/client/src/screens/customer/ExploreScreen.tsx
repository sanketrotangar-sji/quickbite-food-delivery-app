import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { CartBar } from '@/components/CartBar';
import { CuisineCard } from '@/components/explore/CuisineCard';
import { iconForCategory } from '@/components/explore/cuisine-icon';
import { ExploreDishGrid } from '@/components/explore/ExploreDishGrid';
import { ExploreFiltersRow } from '@/components/explore/ExploreFiltersRow';
import { ExploreHeader } from '@/components/explore/ExploreHeader';
import { ExploreNoResults } from '@/components/explore/ExploreNoResults';
import { ExploreRestaurantCard } from '@/components/explore/ExploreRestaurantCard';
import { EXPLORE_SEARCH_PLACEHOLDER, ExploreSearchMode } from '@/components/explore/ExploreSearchMode';
import { OfferCard } from '@/components/explore/OfferCard';
import { FilterSheet } from '@/components/FilterSheet';
import { HomeSearch } from '@/components/home/HomeSearch';
import { ACTIVE_ORDER_BAR_HEIGHT } from '@/components/home/CustomerTabBar';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { tabBarInset } from '@/constants/theme';
import { useAddDish } from '@/hooks/useAddDish';
import { useCart } from '@/hooks/useCart';
import { useHomeCatalog } from '@/hooks/useHomeCatalog';
import { useActiveOrder } from '@/hooks/useOrderTracking';
import { useSavedHearts } from '@/hooks/useSavedHearts';
import {
  applyQuickFilter,
  DEFAULT_EXPLORE_FILTERS,
  exploreFilterCount,
  filterExploreDishes,
  filterExplorePlaces,
  formatPriceRange,
  quickFilterFrom,
  type ExploreFilters,
  type QuickFilter,
} from '@/lib/explore-filters';
import type { HomeDish } from '@/lib/home-mock';
import { POPULAR_CATEGORY_ID, VEG_CATEGORY_ID } from '@/lib/home-mock';
import { placePresentation } from '@/lib/home-presentation';

const PAGE_PAD = 16;
const GRID_GAP = 8;
const OFFER_CARD_WIDTH = 148;
const CART_BAR_SPACE = 72;

export function ExploreScreen() {
  const { width } = useWindowDimensions();
  const catalog = useHomeCatalog();
  const hearts = useSavedHearts();
  const cart = useCart();
  const { activeOrder } = useActiveOrder();
  const { addDish, dialog: cartReplaceDialog } = useAddDish();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_EXPLORE_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const categories = catalog.data?.categories ?? [];
  const cravings = categories.filter((category) => category.id !== POPULAR_CATEGORY_ID);
  const allPlaces = catalog.data?.places ?? [];
  const allDishes = catalog.data?.dishes ?? [];
  const places = useMemo(
    () =>
      filterExplorePlaces(allPlaces, allDishes, query, filters).sort(
        (a, b) => Number(b.isOpen) - Number(a.isOpen) || (b.rating ?? -1) - (a.rating ?? -1),
      ),
    [allDishes, allPlaces, filters, query],
  );
  const matchedDishes = useMemo(
    () => filterExploreDishes(allDishes, allPlaces, query, filters),
    [allDishes, allPlaces, filters, query],
  );
  const dishes = matchedDishes.slice(0, 9);
  const offers = useMemo(
    () => [...places].sort((a, b) => placePresentation(b).discount - placePresentation(a).discount).slice(0, 8),
    [places],
  );
  const prices = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const dish of allDishes) {
      const list = map.get(dish.restaurantId) ?? [];
      list.push(dish.price);
      map.set(dish.restaurantId, list);
    }
    return map;
  }, [allDishes]);
  const suggestions = cravings
    .filter((category) => category.id !== filters.cuisineId)
    .slice(0, 8)
    .map((category) => ({ id: category.id, label: category.label, icon: iconForCategory(category.label) }));
  const cuisineOptions = [
    { id: POPULAR_CATEGORY_ID, label: 'All' },
    ...cravings.map((category) => ({ id: category.id, label: category.label })),
  ];

  const loading = catalog.isLoading && !catalog.data;
  const failed = catalog.isError && !catalog.data;
  const errorMessage = catalog.error instanceof Error ? catalog.error.message : 'Check the connection and try again.';
  const catalogEmpty = !loading && !failed && allPlaces.length === 0 && allDishes.length === 0;
  const noResults = !loading && !failed && !catalogEmpty && places.length === 0 && matchedDishes.length === 0;
  const cardWidth = (width - PAGE_PAD * 2 - GRID_GAP * 2) / 3;
  const filterCount = exploreFilterCount(filters);
  const cartVisible = cart.itemCount > 0;

  function priceLabelFor(placeId: string) {
    return formatPriceRange(prices.get(placeId) ?? []);
  }

  function openRestaurant(id: string) {
    router.push(`/(customer)/restaurant/${id}`);
  }

  function selectCuisine(id: string) {
    setFilters((current) => {
      const nextId = current.cuisineId === id ? POPULAR_CATEGORY_ID : id;
      if (nextId === VEG_CATEGORY_ID) return { ...current, cuisineId: nextId, diet: 'veg' };
      const leavingVeg = current.cuisineId === VEG_CATEGORY_ID && current.diet === 'veg';
      return { ...current, cuisineId: nextId, diet: leavingVeg ? 'all' : current.diet };
    });
  }

  function selectQuick(id: QuickFilter) {
    setFilters((current) => applyQuickFilter(current, id));
  }

  function applyFilters(next: ExploreFilters) {
    if (next.diet === 'nonveg' && next.cuisineId === VEG_CATEGORY_ID) {
      setFilters({ ...next, cuisineId: POPULAR_CATEGORY_ID });
      return;
    }
    if (next.cuisineId === VEG_CATEGORY_ID) {
      setFilters({ ...next, diet: 'veg' });
      return;
    }
    setFilters(next);
  }

  function suggestCuisine(id: string) {
    setQuery('');
    setSearchOpen(false);
    setFilters((current) => ({ ...current, cuisineId: id }));
  }

  function clearFilters() {
    setQuery('');
    setFilters(DEFAULT_EXPLORE_FILTERS);
  }

  const shared = {
    priceLabelFor,
    isLiked: (id: string) => hearts.ids.has(id),
    onToggleLike: (id: string) => hearts.toggle(id),
    onAdd: (dish: HomeDish) => void addDish(dish),
    onOpenRestaurant: openRestaurant,
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      {cartReplaceDialog}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          activeOrder && { paddingBottom: tabBarInset + ACTIVE_ORDER_BAR_HEIGHT + 24 },
          cartVisible && { paddingBottom: tabBarInset + CART_BAR_SPACE + (activeOrder ? ACTIVE_ORDER_BAR_HEIGHT : 0) },
        ]}>
        <View style={styles.stack}>
          <ExploreHeader />
        </View>

        {searchOpen ? (
          <ExploreSearchMode
            query={query}
            onChangeQuery={setQuery}
            onCancel={() => setSearchOpen(false)}
            cravings={cravings}
            selectedCuisineId={filters.cuisineId}
            onSelectCuisine={selectCuisine}
            places={places}
            dishes={dishes}
            cardWidth={cardWidth}
            loading={loading}
            failed={failed}
            errorMessage={errorMessage}
            onRetry={() => void catalog.refetch()}
            catalogEmpty={catalogEmpty}
            suggestions={suggestions}
            onSuggest={suggestCuisine}
            onClear={clearFilters}
            {...shared}
          />
        ) : (
          <>
            <View style={styles.stack}>
              <HomeSearch
                value={query}
                onPress={() => setSearchOpen(true)}
                placeholder={EXPLORE_SEARCH_PLACEHOLDER}
              />
              <ExploreFiltersRow
                selectedId={quickFilterFrom(filters)}
                filterCount={filterCount}
                onSelect={selectQuick}
                onOpenFilters={() => setSheetOpen(true)}
              />
            </View>

            {loading ? (
              <View style={styles.block} accessibilityLabel="Loading kitchens" accessibilityState={{ busy: true }}>
                <LoadingSkeleton variant="feature" rows={2} />
              </View>
            ) : null}

            {failed ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn't load kitchens"
                body={errorMessage}
                actionLabel="Try again"
                onAction={() => void catalog.refetch()}
              />
            ) : null}

            {catalogEmpty ? (
              <EmptyState
                icon="restaurant-outline"
                title="Nothing to explore yet"
                body="Kitchens and dishes will show up here once they're available."
              />
            ) : null}

            {!loading && !failed && !catalogEmpty && cravings.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.block}>
                  <SectionHeader title="What are you craving?" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {cravings.map((category) => (
                    <CuisineCard
                      key={category.id}
                      category={category}
                      selected={filters.cuisineId === category.id}
                      onPress={() => selectCuisine(category.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {noResults ? (
              <ExploreNoResults suggestions={suggestions} onSuggest={suggestCuisine} onClear={clearFilters} />
            ) : null}

            {!loading && !failed && places.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.block}>
                  <SectionHeader title="Restaurants near you" />
                  <View style={styles.list}>
                    {places.map((place) => (
                      <ExploreRestaurantCard
                        key={place.id}
                        place={place}
                        priceLabel={priceLabelFor(place.id)}
                        liked={hearts.ids.has(place.id)}
                        onToggleLike={() => hearts.toggle(place.id)}
                        onPress={() => openRestaurant(place.id)}
                      />
                    ))}
                  </View>
                </View>
              </View>
            ) : null}

            {!loading && !failed && dishes.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.block}>
                  <SectionHeader title="Popular near you" />
                  <ExploreDishGrid
                    dishes={dishes}
                    cardWidth={cardWidth}
                    isLiked={shared.isLiked}
                    onToggleLike={shared.onToggleLike}
                    onAdd={shared.onAdd}
                    onOpen={openRestaurant}
                  />
                </View>
              </View>
            ) : null}

            {!loading && !failed && offers.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.block}>
                  <SectionHeader title="Offers for you" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {offers.map((place) => (
                    <OfferCard key={place.id} place={place} width={OFFER_CARD_WIDTH} onPress={() => openRestaurant(place.id)} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <FilterSheet
        visible={sheetOpen}
        value={filters}
        cuisines={cuisineOptions}
        onClose={() => setSheetOpen(false)}
        onApply={applyFilters}
      />
      <CartBar
        itemCount={cart.itemCount}
        subtotal={cart.subtotal}
        bottomOffset={54 + (activeOrder ? ACTIVE_ORDER_BAR_HEIGHT : 0)}
        onPress={() => router.push('/(customer)/cart')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: tabBarInset + 24, gap: 12 },
  stack: { paddingHorizontal: PAGE_PAD, gap: 12 },
  block: { paddingHorizontal: PAGE_PAD },
  section: { marginTop: 6 },
  rail: { gap: 8, paddingLeft: PAGE_PAD, paddingRight: PAGE_PAD },
  list: { gap: 12 },
});
