import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getTrackedOrder, type TrackedOrder } from '@quickbite/api/mobile/order-tracking';
import { fetchActiveCustomerOrder } from '@quickbite/api/mobile/orders';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { ordersQueryKey } from '@/features/orders/useOrders';
import type { CustomerOrder } from '@/types/models';
import { queryKeys } from '@/lib/query-keys';

export const trackedOrderQueryKey = queryKeys.orders.tracking;
export const activeOrderQueryKey = queryKeys.orders.active;

export function useTrackedOrder(id: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: trackedOrderQueryKey(id ?? ''),
    queryFn: () => getTrackedOrder(id as string),
    enabled: !!id,
    staleTime: 60_000,
    refetchOnMount: false,
  });

  const status = query.data?.status;
  const live = Boolean(id) && status !== 'delivered' && status !== 'cancelled';

  useEffect(() => {
    if (!id || !live) return;
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
  }, [id, live, queryClient]);

  return query;
}

/** Subscribed only while the customer has an order in flight. */
export function useCustomerOrdersRealtime() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const { activeOrder } = useActiveOrder();
  const hasActive = Boolean(activeOrder);

  useEffect(() => {
    if (!userId || !hasActive) return;

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
  }, [hasActive, queryClient, userId]);
}

export function useActiveOrder() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: activeOrderQueryKey,
    queryFn: fetchActiveCustomerOrder,
    enabled: !!session,
    staleTime: 60_000,
    refetchOnMount: false,
  });
  return { ...query, activeOrder: query.data ?? null };
}
