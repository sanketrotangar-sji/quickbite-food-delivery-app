import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import {
  fetchHomeDishes,
  fetchHomeShell,
  type HomeCatalog,
} from '@/api/home';
import { listCustomerOrders } from '@/api/orders';
import { POPULAR_CATEGORY_ID, type HomePlace } from '@/lib/home-catalog';
import { ordersQueryKey } from '@/hooks/useOrders';

export function useHomeCatalog() {
  const queryClient = useQueryClient();
  const shell = useQuery({
    queryKey: ['home-shell'],
    queryFn: fetchHomeShell,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: false,
  });

  const restaurantIds = shell.data?.restaurantIds ?? [];
  const dishes = useQuery({
    queryKey: ['home-dishes', restaurantIds.join(',')],
    queryFn: () => fetchHomeDishes(restaurantIds),
    enabled: restaurantIds.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: false,
  });

  // Prefetch orders after shell settles so first Orders tab tap is warm.
  useEffect(() => {
    if (!shell.isSuccess) return;
    const idle = setTimeout(() => {
      void queryClient.prefetchQuery({
        queryKey: ordersQueryKey,
        queryFn: listCustomerOrders,
        staleTime: 60_000,
      });
    }, 400);
    return () => clearTimeout(idle);
  }, [queryClient, shell.isSuccess]);

  const data = useMemo<HomeCatalog | undefined>(() => {
    if (!shell.data) return undefined;
    const places: HomePlace[] = shell.data.places.map((place) => {
      const patch = dishes.data?.placesPatch.get(place.id);
      if (!patch) return place;
      return {
        ...place,
        dishName: patch.dishName,
        veg: patch.veg,
        hasNonVeg: patch.hasNonVeg,
        categoryIds: patch.categoryIds,
        imageUrl: place.imageUrl || patch.imageUrl,
      };
    });
    return {
      places,
      highlights: shell.data.highlights,
      dishes: dishes.data?.dishes ?? [],
      categories: dishes.data?.categories ?? [
        { id: POPULAR_CATEGORY_ID, label: 'Popular', imageUrl: places[0]?.imageUrl ?? '' },
      ],
    };
  }, [shell.data, dishes.data]);

  return {
    data,
    isLoading: shell.isLoading,
    isFetching: shell.isFetching || dishes.isFetching,
    isError: shell.isError || dishes.isError,
    error: shell.error ?? dishes.error,
    refetch: async () => {
      await shell.refetch();
      await dishes.refetch();
    },
    dishesLoading: dishes.isLoading && !dishes.data,
  };
}
