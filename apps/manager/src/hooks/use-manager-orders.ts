import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listRestaurantOrders, listRestaurantOrderStats, nextKitchenStatus, setRestaurantOrderStatus, type DbOrder } from '@/api/orders';
import { supabase } from '@/integrations/supabase/client';
import type { Order, OrderStatus } from '@/lib/quickbite-data';

import { useOwnedRestaurant } from './use-restaurant';

export function useManagerOrders() {
  const { data: restaurant } = useOwnedRestaurant();
  const restaurantId = restaurant?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['manager-orders', restaurantId],
    queryFn: () => listRestaurantOrders(restaurantId!),
    enabled: Boolean(restaurantId),
  });

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`manager-orders-${restaurantId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['manager-orders', restaurantId] });
          void queryClient.invalidateQueries({ queryKey: ['manager-order-stats', restaurantId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, restaurantId]);

  return query;
}

export function useManagerOrderStats() {
  const { data: restaurant } = useOwnedRestaurant();
  const restaurantId = restaurant?.id;
  return useQuery({
    queryKey: ['manager-order-stats', restaurantId],
    queryFn: () => listRestaurantOrderStats(restaurantId!),
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  });
}

export type { DbOrder };

export function useAdvanceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (current: { id: string; status: OrderStatus }) => {
      const next = nextKitchenStatus(current.status);
      if (!next) return;
      await setRestaurantOrderStatus(current.id, next);
    },
    onMutate: async (current) => {
      const next = nextKitchenStatus(current.status);
      if (!next) return { previous: [] as [readonly unknown[], Order[] | undefined][] };

      await queryClient.cancelQueries({ queryKey: ['manager-orders'] });
      const previous = queryClient.getQueriesData<Order[]>({ queryKey: ['manager-orders'] });
      for (const [key, data] of previous) {
        if (!data) continue;
        queryClient.setQueryData(
          key,
          data.map((order) => (order.id === current.id ? { ...order, status: next } : order)),
        );
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      window.alert(error instanceof Error ? error.message : 'Could not update this order.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-orders'] });
    },
  });
}
