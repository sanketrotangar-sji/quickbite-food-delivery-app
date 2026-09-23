import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listCustomerOrders, placeOrder } from '@/api/orders';
import { cartQueryKey } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';

export const ordersQueryKey = ['orders'] as const;

export function useOrders() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ordersQueryKey,
    queryFn: listCustomerOrders,
    enabled: !!session,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: placeOrder,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cartQueryKey }),
        queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
      ]);
    },
  });
}
