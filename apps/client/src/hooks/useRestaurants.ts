import { useQuery } from '@tanstack/react-query';

import { getRestaurant, listMenuItems, listRestaurantRatings, listRestaurants } from '@/api/restaurants';

export function useRestaurants() {
  return useQuery({
    queryKey: ['restaurants'],
    queryFn: listRestaurants,
  });
}

export function useRestaurant(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => getRestaurant(id!),
    enabled: !!id,
  });
}

export function useRestaurantRatings(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurant-ratings', id],
    queryFn: () => listRestaurantRatings(id!),
    enabled: !!id,
  });
}

export function useMenu(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['menu', restaurantId],
    queryFn: () => listMenuItems(restaurantId!),
    enabled: !!restaurantId,
  });
}
