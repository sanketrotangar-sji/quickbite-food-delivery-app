import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchRestaurantDetail } from '@quickbite/api/mobile/catalog';
import { listRestaurantRatings } from '@quickbite/api/mobile/restaurants';
import { useDeliveryPoint } from '@/features/location/hooks';
import { pointKey } from '@/features/location/store';
import { queryKeys } from '@/lib/query-keys';

const CATALOG_STALE = 45_000;
const CATALOG_GC = 5 * 60_000;

/** Kitchen card + server-grouped menu sections + bestsellers in one call. */
export function useRestaurantDetail(id: string | undefined) {
  const { point } = useDeliveryPoint();
  return useQuery({
    queryKey: queryKeys.restaurant.detail(id ?? '', pointKey(point)),
    queryFn: () => fetchRestaurantDetail(id!, point),
    enabled: !!id,
    staleTime: CATALOG_STALE,
    gcTime: CATALOG_GC,
    placeholderData: keepPreviousData,
  });
}

export function useRestaurantRatings(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.restaurant.ratings(id ?? ''),
    queryFn: () => listRestaurantRatings(id!),
    enabled: !!id,
    staleTime: CATALOG_STALE,
    gcTime: CATALOG_GC,
  });
}
