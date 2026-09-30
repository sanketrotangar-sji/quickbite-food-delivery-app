import { useQuery } from '@tanstack/react-query';

import { getRestaurant, listMenuItems, listRestaurantRatings, listRestaurants } from '@/api/restaurants';

const CATALOG_STALE = 45_000;
const CATALOG_GC = 5 * 60_000;

export function useRestaurants() {
  return useQuery({
    queryKey: ['restaurants'],
    queryFn: listRestaurants,
    staleTime: CATALOG_STALE,
    gcTime: CATALOG_GC,
  });
}

export function useRestaurant(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => getRestaurant(id!),
    enabled: !!id,
    staleTime: CATALOG_STALE,
    gcTime: CATALOG_GC,
  });
}

export function useRestaurantRatings(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurant-ratings', id],
    queryFn: () => listRestaurantRatings(id!),
    enabled: !!id,
    staleTime: CATALOG_STALE,
    gcTime: CATALOG_GC,
  });
}

export function useMenu(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['menu', restaurantId],
    queryFn: () => listMenuItems(restaurantId!),
    enabled: !!restaurantId,
    staleTime: CATALOG_STALE,
    gcTime: CATALOG_GC,
  });
}
