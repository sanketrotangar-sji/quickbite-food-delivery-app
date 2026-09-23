import { StyleSheet, View } from 'react-native';

import { PopularDishCard } from '@/components/home/PopularDishCard';
import type { HomeDish } from '@/lib/home-mock';

export function ExploreDishGrid({
  dishes,
  cardWidth,
  isLiked,
  onToggleLike,
  onAdd,
  onOpen,
}: {
  dishes: HomeDish[];
  cardWidth: number;
  isLiked: (id: string) => boolean;
  onToggleLike: (id: string) => void;
  onAdd: (dish: HomeDish) => void;
  onOpen: (restaurantId: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {dishes.map((dish) => (
        <PopularDishCard
          key={dish.id}
          dish={dish}
          width={cardWidth}
          liked={isLiked(dish.id)}
          onToggleLike={() => onToggleLike(dish.id)}
          onAdd={() => onAdd(dish)}
          onPress={() => onOpen(dish.restaurantId)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
