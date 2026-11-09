import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { CartBar } from '@/components/CartBar';
import { CuisineCard } from '@/features/explore/components/CuisineCard';
import { iconForCategory } from '@/features/explore/components/cuisine-icon';
import { ExploreDishGrid } from '@/features/explore/components/ExploreDishGrid';
import { ExploreFiltersRow } from '@/features/explore/components/ExploreFiltersRow';
import { ExploreHeader } from '@/features/explore/components/ExploreHeader';
import { ExploreNoResults } from '@/features/explore/components/ExploreNoResults';
import { ExploreRestaurantCard } from '@/features/explore/components/ExploreRestaurantCard';
import { EXPLORE_SEARCH_PLACEHOLDER, ExploreSearchMode } from '@/features/explore/components/ExploreSearchMode';
import { OfferCard } from '@/features/explore/components/OfferCard';
import { PhotoSearchSheet } from '@/features/explore/components/PhotoSearchSheet';
import { FilterSheet } from '@/components/FilterSheet';
import { HomeSearch } from '@/features/home/components/HomeSearch';
import { ACTIVE_ORDER_BAR_HEIGHT } from '@/features/home/components/CustomerTabBar';
import { Skeleton } from '@/components/Skeleton';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, tabBarInset } from '@/constants/theme';
import { useAddDish } from '@/features/cart/useAddDish';
import { useCart } from '@/features/cart/useCart';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useBrowseRestaurants, useHomeCatalog } from '@/features/home/hooks';
import { FallbackLocationBanner } from '@/features/location/components/FallbackLocationBanner';
import { useActiveOrder } from '@/features/orders/useOrderTracking';
import { useSavedHearts } from '@/features/profile/useSavedHearts';
import {
  applyQuickFilter,
  DEFAULT_EXPLORE_FILTERS,
  exploreFilterCount,
  filterBrowsedPlaces,
  filterExploreDishes,
  formatPriceRange,
  quickFilterFrom,
  toBrowseFilters,
  type ExploreFilters,
  type QuickFilter,
} from '@/lib/explore-filters';
import type { HomeDish } from '@/lib/home-catalog';
import { POPULAR_CATEGORY_ID, VEG_CATEGORY_ID } from '@/lib/home-catalog';
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
  const debouncedQuery = useDebouncedValue(query, 300);
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_EXPLORE_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  const categories = catalog.data?.categories ?? [];
  const cravings = useMemo(
    () => categories.filter((category) => category.id !== POPULAR_CATEGORY_ID),
    [categories],
  );
  const cuisineLabel = cravings.find((category) => category.id === filters.cuisineId)?.label ?? null;
  const browseFilters = useMemo(
    () => toBrowseFilters(filters, debouncedQuery, cuisineLabel),
    [filters, debouncedQuery, cuisineLabel],
  );
  const browse = useBrowseRestaurants(browseFilters);
  const allPlaces = browse.places;
  const allDishes = catalog.data?.dishes;
  const places = useMemo(() => filterBrowsedPlaces(allPlaces, filters), [allPlaces, filters]);
  const matchedDishes = useMemo(
    () => filterExploreDishes(allDishes ?? [], places, debouncedQuery, filters),
    [allDishes, places, filters, debouncedQuery],
  );
  const dishes = useMemo(() => matchedDishes.slice(0, 9), [matchedDishes]);
  const offers = useMemo(
    () =>
      places
        .filter((place) => placePresentation(place).discount > 0)
        .sort((a, b) => placePresentation(b).discount - placePresentation(a).discount)
        .slice(0, 8),
    [places],
  );
  const prices = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const dish of allDishes ?? []) {
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

  const loading = (catalog.isLoading && !catalog.data) || browse.isLoading;
  const failed = (catalog.isError && !catalog.data) || (browse.isError && allPlaces.length === 0);
  const failure = catalog.error ?? browse.error;
  const errorMessage = failure instanceof Error ? failure.message : 'Check the connection and try again.';
  const catalogEmpty = !loading && !failed && exploreFilterCount(filters) === 0 && !debouncedQuery.trim() && allPlaces.length === 0;
  const noResults = !loading && !failed && !catalogEmpty && places.length === 0 && matchedDishes.length === 0;
  const cardWidth = (width - PAGE_PAD * 2 - GRID_GAP * 2) / 3;
  const filterCount = exploreFilterCount(filters);
  const cartVisible = cart.itemCount > 0;

  function retry() {
    void catalog.refetch();
    void browse.refetch();
  }

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

  const bottomPad =
    tabBarInset +
    24 +
    (activeOrder ? ACTIVE_ORDER_BAR_HEIGHT : 0) +
    (cartVisible ? CART_BAR_SPACE : 0);

  return (
    <Screen>
      <StatusBar style="dark" />
      {cartReplaceDialog}
      <FlashList
        data={searchOpen || loading || failed ? [] : places}
        keyExtractor={(place) => place.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => {
          if (!searchOpen) browse.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.stack}>
              <ExploreHeader />
              <FallbackLocationBanner />
            </View>

            {searchOpen ? (
              <ExploreSearchMode
                query={query}
                onChangeQuery={setQuery}
                onCancel={() => setSearchOpen(false)}
                onCameraPress={() => setPhotoSheetOpen(true)}
                cravings={cravings}
                selectedCuisineId={filters.cuisineId}
                onSelectCuisine={selectCuisine}
                places={places}
                dishes={dishes}
                cardWidth={cardWidth}
                loading={loading}
                failed={failed}
                errorMessage={errorMessage}
                onRetry={retry}
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
                    onCameraPress={() => setPhotoSheetOpen(true)}
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
                    <Skeleton variant="feature" rows={2} />
                  </View>
                ) : null}

                {failed ? (
                  <EmptyState
                    icon="cloud-offline-outline"
                    title="Couldn't load kitchens"
                    body={errorMessage}
                    actionLabel="Try again"
                    onAction={retry}
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
                  <View style={[styles.section, styles.block]}>
                    <SectionHeader title="Restaurants near you" />
                  </View>
                ) : null}
              </>
            )}
          </View>
        }
        renderItem={({ item: place }) => (
          <View style={styles.itemRow}>
            <ExploreRestaurantCard
              place={place}
              priceLabel={priceLabelFor(place.id)}
              liked={hearts.ids.has(place.id)}
              onToggleLike={() => hearts.toggle(place.id)}
              onPress={() => openRestaurant(place.id)}
            />
          </View>
        )}
        ListFooterComponent={
          !searchOpen && !loading && !failed ? (
            <View style={styles.footerBlock}>
              {browse.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.more} /> : null}
              {dishes.length > 0 ? (
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

              {offers.length > 0 ? (
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
            </View>
          ) : null
        }
      />
      <FilterSheet
        visible={sheetOpen}
        value={filters}
        cuisines={cuisineOptions}
        onClose={() => setSheetOpen(false)}
        onApply={applyFilters}
      />
      <PhotoSearchSheet
        visible={photoSheetOpen}
        vegOnly={filters.diet === 'veg'}
        allDishes={allDishes ?? []}
        onClose={() => setPhotoSheetOpen(false)}
        onAddDish={shared.onAdd}
        onOpenRestaurant={openRestaurant}
        onApplyTextQuery={(text) => {
          setQuery(text);
          setSearchOpen(true);
        }}
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
  headerBlock: { gap: 12 },
  footerBlock: { gap: 12 },
  stack: { paddingHorizontal: PAGE_PAD, gap: 12 },
  block: { paddingHorizontal: PAGE_PAD },
  section: { marginTop: 6 },
  rail: { gap: 8, paddingLeft: PAGE_PAD, paddingRight: PAGE_PAD },
  itemRow: { paddingHorizontal: PAGE_PAD, marginBottom: 12 },
  more: { paddingVertical: 16 },
});
