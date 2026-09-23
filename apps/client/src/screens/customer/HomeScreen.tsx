import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CartBar } from '@/components/CartBar';
import { CategoryChips, type CuisineChip } from '@/components/home/CategoryChips';
import { CravingCircle } from '@/components/home/CravingCircle';
import { HomeHero } from '@/components/home/HomeHero';
import { HomeSearch } from '@/components/home/HomeSearch';
import { ACTIVE_ORDER_BAR_HEIGHT } from '@/components/home/CustomerTabBar';
import { PopularDishCard } from '@/components/home/PopularDishCard';
import { PromoBanner } from '@/components/home/PromoBanner';
import { RestaurantStripCard } from '@/components/home/RestaurantStripCard';
import { ShortcutRow, type ShortcutId } from '@/components/home/ShortcutRow';
import { colors, tabBarInset } from '@/constants/theme';
import { useAddresses } from '@/hooks/useAddresses';
import { useAddDish } from '@/hooks/useAddDish';
import { useCart } from '@/hooks/useCart';
import { useHomeCatalog } from '@/hooks/useHomeCatalog';
import { useActiveOrder } from '@/hooks/useOrderTracking';
import { useSavedHearts } from '@/hooks/useSavedHearts';
import { placePresentation } from '@/lib/home-presentation';
import {
  filterHomeDishes,
  filterHomePlaces,
  POPULAR_CATEGORY_ID,
  type DietFilter,
  type HomeHighlight,
} from '@/lib/home-mock';

const PAGE_PAD = 16;
const RAIL_GAP = 8;
const CART_BAR_SPACE = 72;

export function HomeScreen() {
  const { width } = useWindowDimensions();
  const { selected } = useAddresses();
  const cart = useCart();
  const { activeOrder } = useActiveOrder();
  const { addDish, dialog: cartReplaceDialog } = useAddDish();
  const hearts = useSavedHearts();
  const catalog = useHomeCatalog();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(POPULAR_CATEGORY_ID);
  const [diet, setDiet] = useState<DietFilter>('all');
  const [shortcut, setShortcut] = useState<ShortcutId | null>(null);

  const categories = catalog.data?.categories ?? [];
  const chips = useMemo<CuisineChip[]>(() => {
    const rest = categories
      .filter((category) => category.id !== POPULAR_CATEGORY_ID)
      .map((category) => ({ id: category.id, label: category.label, icon: iconForCategory(category.label) }));
    return [
      { id: POPULAR_CATEGORY_ID, label: 'All', icon: 'grid-outline' },
      { id: 'veg', label: 'Pure Veg', icon: 'leaf', tint: '#2E9B57' },
      ...rest,
    ];
  }, [categories]);

  const dishes = useMemo(
    () => filterHomeDishes(catalog.data?.dishes ?? [], categoryId, query, diet),
    [catalog.data?.dishes, categoryId, query, diet],
  );
  // Top restaurants ignore craving/cuisine chips — only search, diet, and shortcuts apply.
  const places = useMemo(() => {
    const filtered = filterHomePlaces(catalog.data?.places ?? [], POPULAR_CATEGORY_ID, query, diet);
    if (shortcut === 'healthy') return filtered.filter((place) => place.veg);
    if (shortcut === 'quick') {
      return [...filtered].sort((a, b) => placePresentation(a).minutesLow - placePresentation(b).minutesLow);
    }
    if (shortcut === 'top') {
      return [...filtered].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    }
    if (shortcut === 'offers') {
      return [...filtered].sort((a, b) => placePresentation(b).discount - placePresentation(a).discount);
    }
    return filtered;
  }, [catalog.data?.places, diet, query, shortcut]);

  const cravings = categories.filter((category) => category.id !== POPULAR_CATEGORY_ID);
  const offers = useMemo(
    () => (catalog.data?.highlights ?? []).filter((item) => item.kind === 'offer'),
    [catalog.data?.highlights],
  );
  const city = (selected?.area || 'Margao, Goa').split(',')[0]?.trim() || 'Margao';
  const railCard = (width - PAGE_PAD - RAIL_GAP * 3) / 3.22;
  const cartVisible = cart.itemCount > 0;

  function selectChip(id: string) {
    setCategoryId(id);
    if (id === 'veg') setDiet('veg');
  }

  function openOffer(offer: HomeHighlight) {
    if (offer.restaurantId) {
      router.push(`/(customer)/restaurant/${offer.restaurantId}`);
      return;
    }
    Alert.alert('Offer coming soon', 'This offer is not linked to a kitchen yet.');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {cartReplaceDialog}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          activeOrder && { paddingBottom: tabBarInset + ACTIVE_ORDER_BAR_HEIGHT + 20 },
          cartVisible && { paddingBottom: tabBarInset + CART_BAR_SPACE + (activeOrder ? ACTIVE_ORDER_BAR_HEIGHT : 0) },
        ]}>
        <HomeHero />
        <View style={styles.block}>
          <HomeSearch value={query} onChangeText={setQuery} />
          <CategoryChips chips={chips} selectedId={categoryId} onSelect={selectChip} />
          <PromoBanner offers={offers} onOrder={openOffer} />
          <ShortcutRow
            selected={shortcut}
            onSelect={(id) => setShortcut((current) => (current === id ? null : id))}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <AppText heading weight="semibold" style={styles.sectionTitle}>
              {`Top Restaurants in ${city}`}
            </AppText>
            <Pressable onPress={() => router.push('/(customer)/(tabs)/picks')} style={styles.seeAllBtn}>
              <AppText weight="semibold" style={styles.seeAll}>
                See all
              </AppText>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>
          {places.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {places.map((place) => (
                <RestaurantStripCard
                  key={place.id}
                  place={place}
                  width={railCard}
                  liked={hearts.ids.has(place.id)}
                  onToggleLike={() => hearts.toggle(place.id)}
                  onPress={() => router.push(`/(customer)/restaurant/${place.id}`)}
                />
              ))}
            </ScrollView>
          ) : (
            <AppText muted style={styles.empty}>
              {catalog.isLoading
                ? 'Loading kitchens…'
                : catalog.isError
                  ? catalog.error instanceof Error
                    ? catalog.error.message
                    : 'Could not load kitchens.'
                  : 'No kitchens match that yet.'}
            </AppText>
          )}
        </View>

        {cravings.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <AppText heading weight="semibold" style={styles.sectionTitle}>
                What are you craving?
              </AppText>
              <Pressable onPress={() => router.push('/(customer)/(tabs)/picks')} style={styles.seeAllBtn}>
                <AppText weight="semibold" style={styles.seeAll}>
                  See all
                </AppText>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </Pressable>
            </View>
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
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <AppText heading weight="semibold" style={styles.sectionTitle}>
              Popular dishes near you
            </AppText>
          </View>
          {dishes.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {dishes.map((dish) => (
                <PopularDishCard
                  key={dish.id}
                  dish={dish}
                  width={railCard}
                  liked={hearts.ids.has(dish.id)}
                  onToggleLike={() => hearts.toggle(dish.id)}
                  onAdd={() => addDish(dish)}
                  onPress={() => router.push(`/(customer)/restaurant/${dish.restaurantId}`)}
                />
              ))}
            </ScrollView>
          ) : (
            <AppText muted style={styles.empty}>
              {catalog.isLoading ? 'Loading dishes…' : 'Nothing matches that craving yet.'}
            </AppText>
          )}
        </View>
      </ScrollView>
      <CartBar
        itemCount={cart.itemCount}
        subtotal={cart.subtotal}
        bottomOffset={54 + (activeOrder ? ACTIVE_ORDER_BAR_HEIGHT : 0)}
        onPress={() => router.push('/(customer)/cart')}
      />
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
  scroll: { paddingBottom: tabBarInset + 20 },
  block: { paddingHorizontal: PAGE_PAD, gap: 12, paddingTop: 8 },
  section: { marginTop: 18, gap: 0 },
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
  empty: { paddingHorizontal: PAGE_PAD },
});
