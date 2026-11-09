import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { toast } from 'sonner-native';

import type { BrowseFilters, PlaceSort } from '@quickbite/api/mobile/catalog';
import { AppText } from '@/components/AppText';
import { CartBar } from '@/components/CartBar';
import { EmptyState } from '@/components/EmptyState';
import { QueryView } from '@/components/QueryView';
import { Skeleton } from '@/components/Skeleton';
import { colors, tabBarInset } from '@/constants/theme';
import { useAddDish } from '@/features/cart/useAddDish';
import { useCart } from '@/features/cart/useCart';
import { CategoryChips, type CuisineChip } from '@/features/home/components/CategoryChips';
import { CravingCircle } from '@/features/home/components/CravingCircle';
import { ACTIVE_ORDER_BAR_HEIGHT } from '@/features/home/components/CustomerTabBar';
import { HomeHero } from '@/features/home/components/HomeHero';
import { HomeSearch } from '@/features/home/components/HomeSearch';
import { PopularDishCard } from '@/features/home/components/PopularDishCard';
import { PromoBanner } from '@/features/home/components/PromoBanner';
import { RestaurantStripCard } from '@/features/home/components/RestaurantStripCard';
import { ShortcutRow, type ShortcutId } from '@/features/home/components/ShortcutRow';
import { VegToggleChip } from '@/features/home/components/VegToggleChip';
import { useBrowseRestaurants, useHomeCatalog } from '@/features/home/hooks';
import { useBrowsePrefs } from '@/features/home/store';
import { FallbackLocationBanner } from '@/features/location/components/FallbackLocationBanner';
import { useDeliveryPoint } from '@/features/location/hooks';
import { useActiveOrder } from '@/features/orders/useOrderTracking';
import { useSavedHearts } from '@/features/profile/useSavedHearts';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  filterHomeDishes,
  POPULAR_CATEGORY_ID,
  type HomeHighlight,
  type HomePlace,
} from '@/lib/home-catalog';

const PAGE_PAD = 16;
const RAIL_GAP = 8;
const CART_BAR_SPACE = 72;

type Row =
  | { type: 'top' }
  | { type: 'filters' }
  | { type: 'orderAgain' }
  | { type: 'cravings' }
  | { type: 'dishes' }
  | { type: 'listHead' }
  | { type: 'place'; place: HomePlace }
  | { type: 'listState' };

const SHORTCUT_SORT: Partial<Record<ShortcutId, PlaceSort>> = { quick: 'eta', top: 'rating', offers: 'offer' };

export function HomeScreen() {
  const { width } = useWindowDimensions();
  const { label } = useDeliveryPoint();
  const cart = useCart();
  const { activeOrder } = useActiveOrder();
  const { addDish, dialog: cartReplaceDialog } = useAddDish();
  const hearts = useSavedHearts();
  const catalog = useHomeCatalog();
  const vegOnly = useBrowsePrefs((s) => s.vegOnly);
  const setVegOnly = useBrowsePrefs((s) => s.setVegOnly);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [categoryId, setCategoryId] = useState(POPULAR_CATEGORY_ID);
  const [shortcut, setShortcut] = useState<ShortcutId | null>(null);

  const categories = catalog.data?.categories ?? [];
  const cravings = categories.filter((category) => category.id !== POPULAR_CATEGORY_ID);
  const cuisineLabel = cravings.find((category) => category.id === categoryId)?.label ?? null;

  const filters = useMemo<BrowseFilters>(
    () => ({
      cuisine: cuisineLabel,
      vegOnly: vegOnly || shortcut === 'healthy',
      offersOnly: shortcut === 'offers',
      query: debouncedQuery.trim() || null,
      sort: (shortcut && SHORTCUT_SORT[shortcut]) ?? 'relevance',
    }),
    [cuisineLabel, vegOnly, shortcut, debouncedQuery],
  );
  const browse = useBrowseRestaurants(filters, { enabled: Boolean(catalog.data) });

  const chips = useMemo<CuisineChip[]>(
    () => [
      { id: POPULAR_CATEGORY_ID, label: 'All', icon: 'grid-outline' },
      ...cravings.map((category) => ({ id: category.id, label: category.label, icon: iconForCategory(category.label) })),
    ],
    [cravings],
  );
  const dishes = useMemo(
    () => filterHomeDishes(catalog.data?.dishes ?? [], categoryId, debouncedQuery, vegOnly ? 'veg' : 'all'),
    [catalog.data?.dishes, categoryId, debouncedQuery, vegOnly],
  );
  const offers = useMemo(
    () => (catalog.data?.highlights ?? []).filter((item) => item.kind === 'offer'),
    [catalog.data?.highlights],
  );
  const orderAgain = catalog.data?.orderAgain ?? [];
  const browsing = categoryId !== POPULAR_CATEGORY_ID || Boolean(debouncedQuery.trim()) || shortcut != null;

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [{ type: 'top' }, { type: 'filters' }];
    if (!browsing && orderAgain.length > 0) list.push({ type: 'orderAgain' });
    if (!browsing && cravings.length > 0) list.push({ type: 'cravings' });
    if (dishes.length > 0) list.push({ type: 'dishes' });
    list.push({ type: 'listHead' });
    if (browse.places.length > 0) {
      for (const place of browse.places) list.push({ type: 'place', place });
    } else {
      list.push({ type: 'listState' });
    }
    return list;
  }, [browsing, orderAgain.length, cravings.length, dishes.length, browse.places]);

  const railCard = (width - PAGE_PAD - RAIL_GAP * 3) / 3.22;
  const cartVisible = cart.itemCount > 0;
  const city = (label ?? 'Margao').split(',')[0]?.trim() || 'Margao';

  const openRestaurant = useCallback((id: string) => router.push(`/(customer)/restaurant/${id}`), []);

  function selectChip(id: string) {
    setCategoryId((current) => (current === id ? POPULAR_CATEGORY_ID : id));
  }

  function openOffer(offer: HomeHighlight) {
    if (offer.restaurantId) {
      openRestaurant(offer.restaurantId);
      return;
    }
    toast('Offer coming soon', { description: 'This offer is not linked to a kitchen yet.' });
  }

  function renderRail(places: HomePlace[]) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {places.map((place) => (
          <RestaurantStripCard
            key={place.id}
            place={place}
            width={railCard}
            liked={hearts.ids.has(place.id)}
            onToggleLike={() => hearts.toggle(place.id)}
            onPress={() => openRestaurant(place.id)}
          />
        ))}
      </ScrollView>
    );
  }

  function renderRow({ item }: { item: Row }) {
    switch (item.type) {
      case 'top':
        return (
          <View>
            <HomeHero />
            <View style={styles.block}>
              <FallbackLocationBanner />
              <HomeSearch value={query} onChangeText={setQuery} />
              <PromoBanner offers={offers} onOrder={openOffer} />
              <ShortcutRow selected={shortcut} onSelect={(id) => setShortcut((current) => (current === id ? null : id))} />
            </View>
          </View>
        );
      case 'filters':
        return (
          <View style={styles.filters}>
            <CategoryChips
              chips={chips}
              selectedId={categoryId}
              onSelect={selectChip}
              leading={<VegToggleChip on={vegOnly} onPress={() => setVegOnly(!vegOnly)} />}
            />
          </View>
        );
      case 'orderAgain':
        return (
          <View style={styles.section}>
            <SectionHead title="Order again" />
            {renderRail(orderAgain)}
          </View>
        );
      case 'cravings':
        return (
          <View style={styles.section}>
            <SectionHead title="What are you craving?" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {cravings.map((category) => (
                <CravingCircle
                  key={category.id}
                  category={category}
                  selected={categoryId === category.id}
                  onPress={() => selectChip(category.id)}
                />
              ))}
            </ScrollView>
          </View>
        );
      case 'dishes':
        return (
          <View style={styles.section}>
            <SectionHead title="Popular dishes near you" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {dishes.map((dish) => (
                <PopularDishCard
                  key={dish.id}
                  dish={dish}
                  width={railCard}
                  liked={hearts.ids.has(dish.id)}
                  onToggleLike={() => hearts.toggle(dish.id)}
                  onAdd={() => addDish(dish)}
                  onPress={() => openRestaurant(dish.restaurantId)}
                />
              ))}
            </ScrollView>
          </View>
        );
      case 'listHead':
        return (
          <View style={styles.section}>
            <SectionHead
              title={browsing ? 'Matching restaurants' : `Restaurants in ${city}`}
              onSeeAll={() => router.push('/(customer)/(tabs)/picks')}
            />
          </View>
        );
      case 'place':
        return (
          <View style={styles.placeRow}>
            <RestaurantStripCard
              layout="list"
              place={item.place}
              liked={hearts.ids.has(item.place.id)}
              onToggleLike={() => hearts.toggle(item.place.id)}
              onPress={() => openRestaurant(item.place.id)}
            />
          </View>
        );
      case 'listState':
        return (
          <QueryView
            loading={catalog.isLoading || browse.isLoading}
            error={catalog.error ?? browse.error}
            onRetry={() => {
              void catalog.refetch();
              void browse.refetch();
            }}
            errorTitle="Could not load kitchens"
            skeleton={<Skeleton variant="list" rows={3} />}
            empty
            emptyState={{
              icon: 'restaurant-outline',
              title: browsing ? 'No kitchens match that' : 'No kitchens deliver here yet',
              body: browsing
                ? 'Try another cuisine or clear your filters.'
                : 'Try another location — we are adding kitchens across Goa.',
              actionLabel: browsing ? 'Clear filters' : undefined,
              onAction: browsing
                ? () => {
                    setCategoryId(POPULAR_CATEGORY_ID);
                    setShortcut(null);
                    setQuery('');
                  }
                : undefined,
            }}>
            {null}
          </QueryView>
        );
    }
  }

  const bottomPad =
    tabBarInset +
    20 +
    (activeOrder ? ACTIVE_ORDER_BAR_HEIGHT : 0) +
    (cartVisible ? CART_BAR_SPACE : 0);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {cartReplaceDialog}
      <FlashList
        data={rows}
        renderItem={renderRow}
        keyExtractor={(row) => (row.type === 'place' ? `place-${row.place.id}` : row.type)}
        getItemType={(row) => row.type}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottomPad }}
        onEndReached={browse.fetchNextPage}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={browse.isRefetching && !browse.isFetchingNextPage}
            onRefresh={() => {
              void catalog.refetch();
              void browse.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        ListFooterComponent={
          browse.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={styles.footer} />
          ) : catalog.isError && catalog.data ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Showing saved results"
              body="We could not refresh just now."
              actionLabel="Retry"
              onAction={() => void catalog.refetch()}
            />
          ) : null
        }
      />
      <CartBar
        itemCount={cart.itemCount}
        subtotal={cart.subtotal}
        bottomOffset={54 + (activeOrder ? ACTIVE_ORDER_BAR_HEIGHT : 0)}
        onPress={() => router.push('/(customer)/cart')}
      />
    </View>
  );
}

function SectionHead({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <AppText heading weight="semibold" style={styles.sectionTitle}>
        {title}
      </AppText>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} style={styles.seeAllBtn} hitSlop={8}>
          <AppText weight="semibold" style={styles.seeAll}>
            See all
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function iconForCategory(label: string): CuisineChip['icon'] {
  const text = label.toLowerCase();
  if (text.includes('north')) return 'nutrition-outline';
  if (text.includes('south')) return 'triangle-outline';
  if (text.includes('chinese') || text.includes('asian')) return 'restaurant-outline';
  if (text.includes('fast') || text.includes('burger')) return 'fast-food-outline';
  if (text.includes('pizza')) return 'pizza-outline';
  if (text.includes('dessert') || text.includes('sweet')) return 'ice-cream-outline';
  if (text.includes('biryani')) return 'flame-outline';
  if (text.includes('healthy') || text.includes('salad')) return 'leaf-outline';
  return 'restaurant-outline';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  block: { paddingHorizontal: PAGE_PAD, gap: 12, paddingTop: 8 },
  filters: {
    paddingHorizontal: PAGE_PAD,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: colors.background,
  },
  section: { marginTop: 18 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PAD,
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: { fontSize: 16 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { color: colors.primary, fontSize: 13 },
  rail: { gap: RAIL_GAP, paddingLeft: PAGE_PAD, paddingRight: PAGE_PAD },
  placeRow: { paddingHorizontal: PAGE_PAD, paddingBottom: 12 },
  footer: { paddingVertical: 16 },
});
