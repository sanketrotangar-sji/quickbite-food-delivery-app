import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { browseRestaurants, fetchHomeFeed, type BrowseFilters, type GeoPoint } from '@quickbite/api/mobile/catalog';
import type { HomeCatalog } from '@quickbite/api/mobile/home';
import { listCustomerOrders } from '@quickbite/api/mobile/orders';
import { toHomeCategories, toHomeDish, toHomeHighlight, toHomePlace } from '@/features/home/adapters';
import { useDeliveryPoint } from '@/features/location/hooks';
import { pointKey } from '@/features/location/store';
import { ordersQueryKey } from '@/features/orders/useOrders';
import { useAuth } from '@/hooks/useAuth';
import type { HomePlace } from '@/lib/home-catalog';
import { queryKeys } from '@/lib/query-keys';

const FEED_STALE_MS = 60_000;
const PAGE_SIZE = 20;

export function homeFeedQuery(point: GeoPoint | null) {
  return {
    queryKey: queryKeys.home.feed(pointKey(point)),
    queryFn: () => fetchHomeFeed(point),
    staleTime: FEED_STALE_MS,
  };
}

/** Warm the home feed while the splash is still on screen. */
export function prefetchHomeFeed(client: QueryClient, point: GeoPoint | null) {
  return client.prefetchQuery(homeFeedQuery(point));
}

export function useHomeFeed() {
  const { point } = useDeliveryPoint();
  return useQuery({ ...homeFeedQuery(point), placeholderData: keepPreviousData });
}

export type HomeCatalogView = HomeCatalog & { orderAgain: HomePlace[]; hasLocation: boolean };

/** Home feed mapped to the card shapes used by Home, Explore and the range guard. */
export function useHomeCatalog() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const feed = useHomeFeed();

  useEffect(() => {
    if (!feed.isSuccess || !session) return;
    const idle = setTimeout(() => {
      void queryClient.prefetchQuery({
        queryKey: ordersQueryKey,
        queryFn: listCustomerOrders,
        staleTime: 60_000,
      });
    }, 400);
    return () => clearTimeout(idle);
  }, [queryClient, session, feed.isSuccess]);

  const data = useMemo<HomeCatalogView | undefined>(() => {
    if (!feed.data) return undefined;
    const places = feed.data.places.map(toHomePlace);
    return {
      places,
      orderAgain: feed.data.orderAgain.map(toHomePlace),
      highlights: feed.data.banners.map(toHomeHighlight),
      dishes: feed.data.popularDishes.map(toHomeDish),
      categories: toHomeCategories(feed.data.categories, places[0]?.imageUrl ?? ''),
      hasLocation: feed.data.hasLocation,
    };
  }, [feed.data]);

  return {
    data,
    isLoading: feed.isLoading,
    isFetching: feed.isFetching,
    isError: feed.isError,
    error: feed.error,
    refetch: async () => {
      await feed.refetch();
    },
  };
}

/** Paged restaurant list (server filters + keyset cursor). */
export function useBrowseRestaurants(filters: BrowseFilters, options?: { enabled?: boolean }) {
  const { point } = useDeliveryPoint();
  const query = useInfiniteQuery({
    queryKey: queryKeys.places.browse(pointKey(point), filters),
    queryFn: ({ pageParam }) =>
      browseRestaurants({ origin: point, filters, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: FEED_STALE_MS,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });

  const places = useMemo(
    () => query.data?.pages.flatMap((page) => page.items.map(toHomePlace)) ?? [],
    [query.data],
  );

  return {
    places,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
  };
}
