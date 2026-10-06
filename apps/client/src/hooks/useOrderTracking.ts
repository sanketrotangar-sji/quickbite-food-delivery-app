import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getTrackedOrder, type TrackedOrder } from '@/api/order-tracking';
import { fetchActiveCustomerOrder } from '@/api/orders';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
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
    staleTime: 60_000,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`customer-order-tracking:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload) => {
        const next = payload.new as Partial<TrackedOrder>;
        queryClient.setQueryData<TrackedOrder>(trackedOrderQueryKey(id), (current) =>
          current ? { ...current, ...next } : current,
        );
        queryClient.setQueryData<CustomerOrder | null>(activeOrderQueryKey, (current) =>
          current?.id === id ? ({ ...current, ...next } as CustomerOrder) : current,
        );
        if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
          void queryClient.invalidateQueries({ queryKey: ordersQueryKey });
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: trackedOrderQueryKey(id) });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rider_locations', filter: `order_id=eq.${id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: trackedOrderQueryKey(id) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  return query;
}

export function useCustomerOrdersRealtime() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`customer-orders-live-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as Partial<CustomerOrder> & { id?: string; status?: string };
          if (next.id) {
            queryClient.setQueryData<CustomerOrder[]>(ordersQueryKey, (current) =>
              current?.map((order) => (order.id === next.id ? { ...order, ...next } : order)),
            );
            queryClient.setQueryData<CustomerOrder | null>(activeOrderQueryKey, (current) => {
              if (!current) return current;
              if (current.id !== next.id) return current;
              const terminal = next.status === 'delivered' || next.status === 'cancelled';
              return terminal ? null : ({ ...current, ...next } as CustomerOrder);
            });
          }
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            void queryClient.invalidateQueries({ queryKey: ordersQueryKey });
            void queryClient.invalidateQueries({ queryKey: activeOrderQueryKey });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}

export function useActiveOrder() {
  const query = useQuery({
    queryKey: activeOrderQueryKey,
    queryFn: fetchActiveCustomerOrder,
    staleTime: 60_000,
    refetchOnMount: false,
  });
  return { ...query, activeOrder: query.data ?? null };
}
