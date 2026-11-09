import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listCustomerOrders, placeOrder } from '@quickbite/api/mobile/orders';
import { cartQueryKey } from '@/features/cart/useCart';
import { useAuth } from '@/hooks/useAuth';
import type { CartLine } from '@/types/models';
import { queryKeys } from '@/lib/query-keys';

export const ordersQueryKey = queryKeys.orders.list;

export function useOrders() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ordersQueryKey,
    queryFn: listCustomerOrders,
    enabled: !!session,
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: placeOrder,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previousCart = queryClient.getQueryData<CartLine[]>(cartQueryKey) ?? [];
      queryClient.setQueryData(cartQueryKey, []);
      return { previousCart };
    },
    onError: (_error, _input, context) => {
      // Checkout renders the failure inline; just restore the cart.
      if (context?.previousCart) queryClient.setQueryData(cartQueryKey, context.previousCart);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cartQueryKey }),
        queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.active }),
      ]);
    },
  });
}
