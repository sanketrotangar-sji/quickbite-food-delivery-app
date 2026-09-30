import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getTrackedOrder, type TrackedOrder } from '@/api/order-tracking';
import { fetchActiveCustomerOrder } from '@/api/orders';
import { supabase } from '@/api/supabaseClient';
import { ordersQueryKey } from '@/hooks/useOrders';
import type { CustomerOrder } from '@/types/models';

export const trackedOrderQueryKey = (id: string) => ['order-tracking', id] as const;
export const activeOrderQueryKey = ['active-order'] as const;

export function useTrackedOrder(id: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: trackedOrderQueryKey(id ?? ''),
    queryFn: () => getTrackedOrder(id as string),
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;
    const refreshOrder = () => {
      void queryClient.invalidateQueries({ queryKey: trackedOrderQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    };
    const channel = supabase
      .channel(`customer-order-tracking:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload) => {
        const next = payload.new as Partial<TrackedOrder>;
        queryClient.setQueryData<TrackedOrder>(trackedOrderQueryKey(id), (current) =>
          current ? { ...current, ...next } : current,
        );
        refreshOrder();
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${id}` },
        refreshOrder,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rider_locations', filter: `order_id=eq.${id}` },
        refreshOrder,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  return query;
}

export function useCustomerOrdersRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('customer-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const next = payload.new as Partial<CustomerOrder> & { id?: string };
        if (next.id) {
          queryClient.setQueryData<CustomerOrder[]>(ordersQueryKey, (current) =>
            current?.map((order) => (order.id === next.id ? { ...order, ...next } : order)),
          );
        }
        void queryClient.invalidateQueries({ queryKey: activeOrderQueryKey });
        // Patch-in-place above; only refetch list when structure may have changed.
        if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
          void queryClient.invalidateQueries({ queryKey: ordersQueryKey });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history' }, () => {
        void queryClient.invalidateQueries({ queryKey: activeOrderQueryKey });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_locations' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['order-tracking'] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

export function useActiveOrder() {
  const query = useQuery({
    queryKey: activeOrderQueryKey,
    queryFn: fetchActiveCustomerOrder,
    staleTime: 15_000,
  });
  return { ...query, activeOrder: query.data ?? null };
}
