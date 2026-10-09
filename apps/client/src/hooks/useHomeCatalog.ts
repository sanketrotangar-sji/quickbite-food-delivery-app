import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import {
  fetchHomeDishes,
  fetchHomeShell,
  type HomeCatalog,
} from '@/api/home';
import { listCustomerOrders } from '@/api/orders';
import { useAddresses } from '@/hooks/useAddresses';
import { POPULAR_CATEGORY_ID, type HomePlace } from '@/lib/home-catalog';
import { distanceKm } from '@/lib/geo';
import { ordersQueryKey } from '@/hooks/useOrders';

export function withDistance(
  places: HomePlace[],
  origin: { latitude: number; longitude: number } | null,
): HomePlace[] {
  if (!origin) {
    return places.map((place) => ({ ...place, distanceKm: null }));
  }
  return places.map((place) => {
    if (place.lat == null || place.lng == null) return { ...place, distanceKm: null };
    return {
      ...place,
      distanceKm: distanceKm(origin, { latitude: place.lat, longitude: place.lng }),
    };
  });
}

export function sortPlacesByDistance(places: HomePlace[]): HomePlace[] {
  return [...places].sort((a, b) => {
    const open = Number(b.isOpen) - Number(a.isOpen);
    if (open !== 0) return open;
    const da = a.distanceKm;
    const db = b.distanceKm;
    if (da == null && db == null) return a.name.localeCompare(b.name);
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db || a.name.localeCompare(b.name);
  });
}

export function useHomeCatalog() {
  const queryClient = useQueryClient();
  const { selected } = useAddresses();
  const origin =
    selected?.lat != null && selected?.lng != null
      ? { latitude: Number(selected.lat), longitude: Number(selected.lng) }
      : null;

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
    const places: HomePlace[] = sortPlacesByDistance(
      withDistance(
        shell.data.places.map((place) => {
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
        }),
        origin,
      ),
    );
    return {
      places,
      highlights: shell.data.highlights,
      dishes: dishes.data?.dishes ?? [],
      categories: dishes.data?.categories ?? [
        { id: POPULAR_CATEGORY_ID, label: 'Popular', imageUrl: places[0]?.imageUrl ?? '' },
      ],
    };
  }, [shell.data, dishes.data, origin?.latitude, origin?.longitude]);

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
    hasOrigin: Boolean(origin),
  };
}
