import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { fetchFavoritesCatalog } from '@/api/home';
import { EmptyState } from '@/components/EmptyState';
import { FlowHeader } from '@/components/FlowHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { PopularDishCard } from '@/components/home/PopularDishCard';
import { RestaurantStripCard } from '@/components/home/RestaurantStripCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAddDish } from '@/hooks/useAddDish';
import { useSavedHearts } from '@/hooks/useSavedHearts';

const PAGE_PAD = 16;

export function FavoritesScreen() {
  const { width } = useWindowDimensions();
  const hearts = useSavedHearts();
  const heartIds = [...hearts.ids];
  const favorites = useQuery({
    queryKey: ['favorites-catalog', heartIds.slice().sort().join(',')],
    queryFn: () => fetchFavoritesCatalog(heartIds),
    enabled: hearts.ready && heartIds.length > 0,
    staleTime: 60_000,
    refetchOnMount: false,
  });
  const { addDish, dialog: cartReplaceDialog } = useAddDish();
  const dishes = favorites.data?.dishes ?? [];
  const places = favorites.data?.places ?? [];
  const loading = (!hearts.ready || favorites.isLoading) && dishes.length === 0 && places.length === 0;
  const empty = hearts.ready && heartIds.length === 0;
  const emptyResolved = !loading && !empty && dishes.length === 0 && places.length === 0;
  const railCard = (width - PAGE_PAD - 8 * 3) / 2.2;

  return (
    <Screen>
      <StatusBar style="dark" />
      {cartReplaceDialog}
      <FlowHeader title="Favorites" subtitle="Kitchens and dishes you saved" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {loading ? <LoadingSkeleton rows={2} /> : null}
        {favorites.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load favorites"
            body={favorites.error instanceof Error ? favorites.error.message : 'Try again in a moment.'}
            actionLabel="Try again"
            onAction={() => void favorites.refetch()}
          />
        ) : null}
        {(empty || emptyResolved) && !favorites.isError ? (
          <EmptyState
            icon="heart-outline"
            title="Nothing saved yet"
            body="Tap the heart on a kitchen or dish. It will wait for you here."
            actionLabel="Explore kitchens"
            onAction={() => router.push('/(customer)/(tabs)/picks')}
          />
        ) : null}

        {places.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.headerPad}>
              <SectionHeader title="Favorite restaurants" />
            </View>
            <View style={styles.list}>
              {places.map((place) => (
                <RestaurantStripCard
                  key={place.id}
                  layout="list"
                  place={place}
                  liked
                  onToggleLike={() => hearts.toggle(place.id)}
                  onPress={() => router.push(`/(customer)/restaurant/${place.id}`)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {dishes.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.headerPad}>
              <SectionHeader title="Favorite dishes" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {dishes.map((dish) => (
                <PopularDishCard
                  key={dish.id}
                  dish={dish}
                  width={railCard}
                  liked
                  onToggleLike={() => hearts.toggle(dish.id)}
                  onAdd={() => void addDish(dish)}
                  onPress={() => router.push(`/(customer)/restaurant/${dish.restaurantId}`)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 28, gap: 16 },
  section: { gap: 8 },
  headerPad: { paddingHorizontal: PAGE_PAD },
  list: { paddingHorizontal: PAGE_PAD, gap: 10 },
  rail: { paddingHorizontal: PAGE_PAD, gap: 10 },
});
