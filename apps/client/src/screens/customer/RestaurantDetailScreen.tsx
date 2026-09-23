import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { CartBar } from '@/components/CartBar';
import { EmptyState } from '@/components/EmptyState';
import { ExploreRestaurantCard } from '@/components/explore/ExploreRestaurantCard';
import { CategoryChips, type CuisineChip } from '@/components/home/CategoryChips';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { MenuItemRow } from '@/components/MenuItemRow';
import { CustomizeSheet } from '@/components/restaurant/CustomizeSheet';
import { RestaurantInfo } from '@/components/restaurant/RestaurantInfo';
import { RestaurantReviews } from '@/components/restaurant/RestaurantReviews';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, formatInr, radii, screenTopGap } from '@/constants/theme';
import { useCart } from '@/hooks/useCart';
import { useCartReplacePrompt } from '@/hooks/useCartReplacePrompt';
import { useHomeCatalog } from '@/hooks/useHomeCatalog';
import { useMenu, useRestaurant, useRestaurantRatings } from '@/hooks/useRestaurants';
import { useSavedHearts } from '@/hooks/useSavedHearts';
import { formatPriceRange } from '@/lib/explore-filters';
import { customizationFor } from '@/lib/menu-customization';
import { menuSections, priceForTwo } from '@/lib/menu-sections';
import { presentationFor } from '@/lib/home-presentation';
import type { MenuItem } from '@/types/models';

const PAGE_PAD = 16;

export function RestaurantDetailScreen({ restaurantId }: { restaurantId?: string }) {
  const insets = useSafeAreaInsets();
  const restaurantQuery = useRestaurant(restaurantId);
  const menuQuery = useMenu(restaurantId);
  const ratingsQuery = useRestaurantRatings(restaurantId);
  const catalog = useHomeCatalog();
  const cart = useCart();
  const replace = useCartReplacePrompt();
  const hearts = useSavedHearts();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const jumping = useRef(false);
  const [activeId, setActiveId] = useState('recommended');
  const [offerOpen, setOfferOpen] = useState(false);
  const [customItem, setCustomItem] = useState<MenuItem | null>(null);

  const restaurant = restaurantQuery.data;
  const menu = menuQuery.data ?? [];
  const sections = useMemo(() => menuSections(menu), [menu]);
  const offer = presentationFor(restaurantId || 'kitchen', {
    offerPercent: restaurant?.offer_percent,
    prepMinutes: restaurant?.prep_minutes,
  });
  const prices = menu.map((item) => Number(item.price)).filter((price) => !Number.isNaN(price));
  const forTwo = priceForTwo(prices);
  const allVeg = menu.length > 0 && menu.every((item) => item.is_veg);
  const diet = menu.length === 0 ? '' : allVeg ? 'Pure Veg' : 'Veg & non-veg';
  const cuisine = [restaurant?.cuisine || 'Multi-cuisine', diet].filter(Boolean).join(' · ');
  const closed = restaurant ? !restaurant.is_open : true;
  const ratings = ratingsQuery.data ?? [];
  const average = ratings.length > 0 ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
  const chips = useMemo<CuisineChip[]>(
    () =>
      sections.map((section) => ({
        id: section.id,
        label: section.label,
        icon: section.id === 'recommended' ? 'star-outline' : 'restaurant-outline',
      })),
    [sections],
  );
  const lines = cart.items.filter((line) => line.restaurant_id === restaurantId);
  const similar = useMemo(() => {
    const places = (catalog.data?.places ?? []).filter((place) => place.id !== restaurantId);
    const needle = (restaurant?.cuisine ?? '').toLowerCase();
    return [...places]
      .sort((a, b) => {
        const aMatch = needle && a.cuisine.toLowerCase().includes(needle) ? 1 : 0;
        const bMatch = needle && b.cuisine.toLowerCase().includes(needle) ? 1 : 0;
        return bMatch - aMatch || (b.rating ?? -1) - (a.rating ?? -1);
      })
      .slice(0, 3);
  }, [catalog.data?.places, restaurant?.cuisine, restaurantId]);

  if (!restaurantId) {
    return (
      <View style={styles.root}>
        <AppText style={styles.missing}>Missing restaurant.</AppText>
      </View>
    );
  }

  const id = restaurantId;

  function previewFor(item: MenuItem) {
    return {
      name: item.name,
      price: Number(item.price),
      imageUrl: item.image_url,
      isAvailable: item.is_available,
      isVeg: item.is_veg,
      restaurantName: restaurant?.name ?? 'Kitchen',
      isOpen: Boolean(restaurant?.is_open),
    };
  }

  async function addItem(item: MenuItem) {
    const input = { menuItemId: item.id, restaurantId: id, preview: previewFor(item) };
    try {
      await replace.runWithReplacePrompt(() => cart.addItem.mutateAsync(input));
    } catch (error) {
      Alert.alert('Could not add', error instanceof Error ? error.message : 'Try again.');
    }
  }

  function requestAdd(item: MenuItem) {
    if (closed || !item.is_available) return;
    if (customizationFor(item)) {
      setCustomItem(item);
      return;
    }
    void addItem(item);
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(customer)/(tabs)');
  }

  function categoryAt(offset: number) {
    let current = sections[0]?.id ?? '';
    for (const section of sections) {
      if ((sectionY.current[section.id] ?? 0) - 56 <= offset) current = section.id;
    }
    return current;
  }

  function jumpTo(sectionId: string) {
    jumping.current = true;
    setActiveId(sectionId);
    const y = sectionY.current[sectionId] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 52), animated: true });
  }

  function onScroll(offset: number) {
    if (jumping.current) return;
    const current = categoryAt(offset);
    if (current && current !== activeId) setActiveId(current);
  }

  const loading = restaurantQuery.isLoading && !restaurant;
  const failed = restaurantQuery.isError && !restaurant;
  const custom = customItem ? customizationFor(customItem) : null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {loading ? (
        <View style={[styles.pad, { paddingTop: insets.top + screenTopGap }]}>
          <LoadingSkeleton variant="feature" rows={2} />
        </View>
      ) : null}
      {failed ? (
        <View style={{ paddingTop: insets.top + screenTopGap }}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this kitchen"
          body={restaurantQuery.error instanceof Error ? restaurantQuery.error.message : 'Check the connection and try again.'}
          actionLabel="Try again"
          onAction={() => void restaurantQuery.refetch()}
        />
        </View>
      ) : null}
      {restaurant ? (
        <ScrollView
          ref={scrollRef}
          stickyHeaderIndices={sections.length > 0 ? [4] : undefined}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => onScroll(event.nativeEvent.contentOffset.y)}
          onMomentumScrollEnd={(event) => {
            jumping.current = false;
            const current = categoryAt(event.nativeEvent.contentOffset.y);
            if (current) setActiveId(current);
          }}
          contentContainerStyle={{ paddingBottom: cart.itemCount > 0 ? 120 : 32 }}>
          <View>
            {restaurant.image_url ? (
              <Image source={{ uri: restaurant.image_url }} style={styles.hero} />
            ) : (
              <View style={[styles.hero, styles.heroFallback]}>
                <AppText weight="bold" style={styles.heroLetter}>
                  {restaurant.name.slice(0, 1).toUpperCase()}
                </AppText>
              </View>
            )}
            <View style={[styles.overlay, { top: insets.top + 8 }]}>
              <Pressable onPress={goBack} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
              <View style={styles.overlayGap} />
              <Pressable
                onPress={() => hearts.toggle(restaurant.id)}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel={hearts.ids.has(restaurant.id) ? 'Remove favorite' : 'Save restaurant'}>
                <Ionicons
                  name={hearts.ids.has(restaurant.id) ? 'heart' : 'heart-outline'}
                  size={18}
                  color={hearts.ids.has(restaurant.id) ? colors.primary : colors.text}
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  void Share.share({ message: `${restaurant.name} on QuickBite` }).catch(() => undefined);
                }}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Share restaurant">
                <Ionicons name="share-outline" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.block}>
            <AppText heading weight="semibold" style={styles.name}>
              {restaurant.name}
            </AppText>
            <View style={styles.metaRow}>
              <Ionicons name="star" size={14} color="#E0A106" />
              <AppText weight="semibold" style={styles.meta}>
                {average != null ? `${average.toFixed(1)} · ${ratings.length} ratings` : 'New'}
              </AppText>
            </View>
            <AppText muted style={styles.meta}>
              {cuisine}
            </AppText>
            <View style={styles.facts}>
              <Fact icon="time-outline" label={offer.eta} />
              {forTwo != null ? <Fact icon="wallet-outline" label={`${formatInr(forTwo)} for two`} /> : null}
              <Fact icon="bicycle-outline" label={`Free delivery above ${formatInr(offer.freeAbove)}`} />
            </View>
          </View>

          <View style={styles.block}>
            <View style={styles.status}>
              <View style={[styles.dot, { backgroundColor: closed ? colors.danger : colors.success }]} />
              <AppText weight="semibold" style={styles.meta}>
                {closed ? 'Currently closed' : 'Open now'}
              </AppText>
              <AppText muted style={styles.meta}>
                {closed ? 'Ordering is paused' : `Delivery: ${offer.eta}`}
              </AppText>
            </View>
          </View>

          <View style={styles.block}>
            <Pressable onPress={() => setOfferOpen((current) => !current)} style={styles.offer} accessibilityRole="button">
              <View style={styles.offerCopy}>
                <AppText weight="bold" style={styles.offerTitle}>
                  {offer.discount}% OFF
                </AppText>
                <AppText muted style={styles.meta}>
                  Free delivery above {formatInr(offer.freeAbove)}
                </AppText>
                {offerOpen ? (
                  <AppText muted style={styles.meta}>
                    Shown on Explore for this kitchen. Checkout charges the menu total.
                  </AppText>
                ) : null}
              </View>
              <AppText weight="semibold" style={styles.offerLink}>
                {offerOpen ? 'Hide' : 'View details'}
              </AppText>
            </Pressable>
          </View>

          {sections.length > 0 ? (
            <View style={styles.tabs}>
              <CategoryChips
                chips={chips}
                selectedId={sections.some((section) => section.id === activeId) ? activeId : (sections[0]?.id ?? '')}
                onSelect={jumpTo}
              />
            </View>
          ) : null}

          {menuQuery.isLoading && menu.length === 0 ? (
            <View style={styles.block}>
              <LoadingSkeleton rows={3} />
            </View>
          ) : null}

          {sections.map((section) => (
            <View
              key={section.id}
              style={styles.block}
              onLayout={(event) => {
                sectionY.current[section.id] = event.nativeEvent.layout.y;
              }}>
              <SectionHeader title={section.label} />
              {section.items.map((item) => {
                const line = lines.find((entry) => entry.menu_item_id === item.id);
                const quantity = line?.quantity ?? 0;
                return (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    disabled={closed}
                    quantity={quantity}
                    liked={hearts.ids.has(item.id)}
                    onToggleLike={() => hearts.toggle(item.id)}
                    onAdd={() => requestAdd(item)}
                    onIncrease={() => {
                      if (closed || !item.is_available) return;
                      void addItem(item);
                    }}
                    onDecrease={() => {
                      if (!line) return;
                      void cart.updateQuantity.mutateAsync({ id: line.id, quantity: quantity - 1 });
                    }}
                  />
                );
              })}
            </View>
          ))}

          {!menuQuery.isLoading && menu.length === 0 ? (
            <AppText muted style={styles.block}>
              No dishes yet.
            </AppText>
          ) : null}

          <View style={styles.block}>
            <RestaurantInfo
              rows={[
                { id: 'about', label: 'About', icon: 'restaurant-outline', body: restaurant.description?.trim() || 'A QuickBite kitchen.' },
                { id: 'address', label: 'Address', icon: 'location-outline', body: restaurant.address },
                {
                  id: 'hours',
                  label: 'Opening hours',
                  icon: 'time-outline',
                  body: closed ? 'Currently closed. Ordering resumes when the kitchen opens.' : `Open now. Delivery in ${offer.eta}.`,
                },
                { id: 'contact', label: 'Contact', icon: 'call-outline', body: 'Phone is not listed for this kitchen.' },
                {
                  id: 'delivery',
                  label: 'Delivery information',
                  icon: 'bicycle-outline',
                  body: `${offer.eta}. Free delivery above ${formatInr(offer.freeAbove)}.`,
                },
              ]}
            />
          </View>

          <View style={styles.block}>
            <RestaurantReviews ratings={ratings} />
          </View>

          {similar.length > 0 ? (
            <View style={styles.block}>
              <SectionHeader title="You may also like" />
              <View style={styles.similar}>
                {similar.map((place) => (
                  <ExploreRestaurantCard
                    key={place.id}
                    place={place}
                    priceLabel={formatPriceRange(
                      (catalog.data?.dishes ?? []).filter((dish) => dish.restaurantId === place.id).map((dish) => dish.price),
                    )}
                    liked={hearts.ids.has(place.id)}
                    onToggleLike={() => hearts.toggle(place.id)}
                    onPress={() => router.push(`/(customer)/restaurant/${place.id}`)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
      <CartBar itemCount={cart.itemCount} subtotal={cart.subtotal} onPress={() => router.push('/(customer)/cart')} />
      <CustomizeSheet
        item={customItem}
        sizes={custom?.sizes ?? []}
        addons={custom?.addons ?? []}
        onClose={() => setCustomItem(null)}
        onAdd={(item) => void addItem(item)}
      />
      {replace.dialog}
    </View>
  );
}

function Fact({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <AppText style={styles.meta}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  missing: { padding: 24 },
  pad: { paddingHorizontal: PAGE_PAD },
  hero: { width: '100%', height: 220, backgroundColor: colors.primarySoft },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroLetter: { color: colors.primary, fontSize: 36 },
  overlay: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  overlayGap: { flex: 1 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { paddingHorizontal: PAGE_PAD, paddingTop: 14, gap: 6 },
  name: { fontSize: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 13 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  offerCopy: { flex: 1, gap: 2 },
  offerTitle: { color: colors.primary, fontSize: 14 },
  offerLink: { color: colors.primary, fontSize: 13 },
  tabs: {
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingLeft: PAGE_PAD,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  similar: { gap: 12 },
});
