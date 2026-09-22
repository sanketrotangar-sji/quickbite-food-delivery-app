import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isPartner } from '@/api/profiles';
import {
  listMyRestaurants,
  updateOwnedRestaurant,
  getRestaurantRatingSummary,
  type RestaurantPatch,
} from '@/api/restaurants';

import { useAuth } from './use-auth';

const SELECTED_KEY = 'quickbite.selectedRestaurantId';

export function useOwnedRestaurant() {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const enabled = Boolean(userId) && isPartner(profile);
  const query = useQuery({
    queryKey: ['my-restaurants', userId],
    queryFn: listMyRestaurants,
    enabled,
  });
  const restaurants = query.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(SELECTED_KEY);
    if (stored && restaurants.some((row) => row.id === stored)) {
      setSelectedId(stored);
      return;
    }
    setSelectedId(restaurants[0]?.id ?? null);
  }, [restaurants]);

  const restaurant = restaurants.find((row) => row.id === selectedId) ?? restaurants[0] ?? null;

  function selectRestaurant(id: string) {
    setSelectedId(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SELECTED_KEY, id);
    }
  }

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    data: restaurant ?? undefined,
    restaurants,
    selectRestaurant,
    isOwner: Boolean(restaurant && userId && restaurant.owner_id === userId),
    refetch: query.refetch,
  };
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
