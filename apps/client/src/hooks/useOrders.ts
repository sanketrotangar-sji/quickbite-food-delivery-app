import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { listCustomerOrders, placeOrder } from '@/api/orders';
import { cartQueryKey } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import type { CartLine } from '@/types/models';

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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previousCart = queryClient.getQueryData<CartLine[]>(cartQueryKey) ?? [];
      queryClient.setQueryData(cartQueryKey, []);
      return { previousCart };
    },
    onError: (error, _input, context) => {
      if (context?.previousCart) queryClient.setQueryData(cartQueryKey, context.previousCart);
      Alert.alert('Could not place order', error instanceof Error ? error.message : 'Try again.');
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cartQueryKey }),
        queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['active-order'] }),
      ]);
    },
  });
}
