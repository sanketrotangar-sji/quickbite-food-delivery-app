import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listRestaurantOrders, nextKitchenStatus, setRestaurantOrderStatus } from '@/api/orders';
import { supabase } from '@/integrations/supabase/client';
import type { OrderStatus } from '@/lib/quickbite-data';

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
    // Unique name per mount — shell + page both call this hook; reusing the
    // same channel name would throw "cannot add callbacks after subscribe()".
    const channel = supabase
      .channel(`manager-orders-${restaurantId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['manager-orders', restaurantId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, restaurantId]);

  return query;
}

export function useAdvanceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (current: { id: string; status: OrderStatus }) => {
      const next = nextKitchenStatus(current.status);
      if (!next) return;
      await setRestaurantOrderStatus(current.id, next);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-orders'] });
    },
  });
}
