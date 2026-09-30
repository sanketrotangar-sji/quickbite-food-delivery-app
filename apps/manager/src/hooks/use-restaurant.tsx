import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isPartner } from '@/api/profiles';
import {
  listMyRestaurants,
  updateOwnedRestaurant,
  getRestaurantRatingSummary,
  type Restaurant,
  type RestaurantPatch,
} from '@/api/restaurants';

import { useAuth } from './use-auth';

function selectedKey(userId: string) {
  return `quickbite.selectedRestaurantId.${userId}`;
}

type RestaurantContextValue = {
  isLoading: boolean;
  isError: boolean;
  data: Restaurant | undefined;
  restaurants: Restaurant[];
  selectRestaurant: (id: string) => void;
  isOwner: boolean;
  refetch: () => Promise<unknown>;
};

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const enabled = Boolean(userId) && isPartner(profile);
  const query = useQuery({
    queryKey: ['my-restaurants', userId],
    queryFn: listMyRestaurants,
    enabled,
    staleTime: 60_000,
  });
  const restaurants = query.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setSelectedId(null);
      return;
    }
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(selectedKey(userId));
    if (stored && restaurants.some((row) => row.id === stored)) {
      setSelectedId(stored);
      return;
    }
    setSelectedId(restaurants[0]?.id ?? null);
  }, [restaurants, userId]);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;
    // Migrate legacy unscoped key once.
    const legacy = window.localStorage.getItem('quickbite.selectedRestaurantId');
    if (legacy && restaurants.some((row) => row.id === legacy)) {
      window.localStorage.setItem(selectedKey(userId), legacy);
      window.localStorage.removeItem('quickbite.selectedRestaurantId');
    }
  }, [restaurants, userId]);

  const restaurant = restaurants.find((row) => row.id === selectedId) ?? restaurants[0] ?? null;

  const selectRestaurant = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (userId && typeof window !== 'undefined') {
        window.localStorage.setItem(selectedKey(userId), id);
      }
    },
    [userId],
  );

  const value = useMemo<RestaurantContextValue>(
    () => ({
      isLoading: query.isLoading,
      isError: query.isError,
      data: restaurant ?? undefined,
      restaurants,
      selectRestaurant,
      isOwner: Boolean(restaurant && userId && restaurant.owner_id === userId),
      refetch: query.refetch,
    }),
    [query.isLoading, query.isError, query.refetch, restaurant, restaurants, selectRestaurant, userId],
  );

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useOwnedRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) {
    throw new Error('useOwnedRestaurant must be used inside RestaurantProvider');
  }
  return ctx;
}

export function useRestaurantRatings(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['restaurant-ratings', restaurantId],
    queryFn: () => getRestaurantRatingSummary(restaurantId!),
    enabled: Boolean(restaurantId),
  });
}

export function useUpdateRestaurant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RestaurantPatch }) => updateOwnedRestaurant(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-restaurants'] });
    },
  });
}
