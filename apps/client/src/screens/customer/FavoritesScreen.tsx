import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { FlowHeader } from '@/components/FlowHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { PopularDishCard } from '@/components/home/PopularDishCard';
import { RestaurantStripCard } from '@/components/home/RestaurantStripCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAddDish } from '@/hooks/useAddDish';
import { useHomeCatalog } from '@/hooks/useHomeCatalog';
import { useSavedHearts } from '@/hooks/useSavedHearts';

const PAGE_PAD = 16;

export function FavoritesScreen() {
  const { width } = useWindowDimensions();
  const catalog = useHomeCatalog();
  const hearts = useSavedHearts();
  const { addDish, dialog: cartReplaceDialog } = useAddDish();
  const dishes = (catalog.data?.dishes ?? []).filter((dish) => hearts.ids.has(dish.id));
  const places = (catalog.data?.places ?? []).filter((place) => hearts.ids.has(place.id));
  const loading = (catalog.isLoading || !hearts.ready) && dishes.length === 0 && places.length === 0;
  const empty = !loading && dishes.length === 0 && places.length === 0;
  const railCard = (width - PAGE_PAD - 8 * 3) / 2.2;

  return (
    <Screen>
      <StatusBar style="dark" />
      {cartReplaceDialog}
      <FlowHeader title="Favorites" subtitle="Kitchens and dishes you saved" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {loading ? <LoadingSkeleton rows={2} /> : null}
        {catalog.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load favorites"
            body={catalog.error instanceof Error ? catalog.error.message : 'Try again in a moment.'}
            actionLabel="Try again"
            onAction={() => void catalog.refetch()}
          />
        ) : null}
        {empty && !catalog.isError ? (
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
  scroll: { paddingBottom: 28, gap: 18 },
  section: { gap: 0 },
  headerPad: { paddingHorizontal: PAGE_PAD },
  list: { paddingHorizontal: PAGE_PAD, gap: 10 },
  rail: { gap: 8, paddingHorizontal: PAGE_PAD },
});
