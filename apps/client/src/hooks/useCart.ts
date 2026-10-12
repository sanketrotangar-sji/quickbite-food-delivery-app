import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { addCartItem, clearCart, listCart, setCartQuantity } from '@/api/cart';
import { STANDARD_DELIVERY_FEE } from '@/constants/pricing';
import { useAuth } from '@/hooks/useAuth';
import type { CartLine } from '@/types/models';

export const cartQueryKey = ['cart'] as const;

export type CartItemPreview = {
  name: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isVeg: boolean;
  restaurantName: string;
  isOpen: boolean;
};

function alertCartError(error: unknown) {
  Alert.alert('Cart update failed', error instanceof Error ? error.message : 'Try again.');
}

export function useCart() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const customerId = session?.user.id;

  const query = useQuery({
    queryKey: cartQueryKey,
    queryFn: listCart,
    enabled: !!customerId,
    staleTime: 60_000,
    refetchOnMount: false,
  });

  const items = query.data ?? [];
  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = items.reduce((sum, line) => sum + line.quantity * Number(line.menu_items?.price ?? 0), 0);
  const offerPercent = Math.max(0, Math.min(100, Number(items[0]?.restaurants?.offer_percent ?? 0)));
  const discountAmount =
    offerPercent > 0 ? Math.round(subtotal * (offerPercent / 100) * 100) / 100 : 0;
  const discountedSubtotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const deliveryFee = itemCount > 0 ? STANDARD_DELIVERY_FEE : 0;
  const total = discountedSubtotal + deliveryFee;
  const restaurantName = items[0]?.restaurants?.name ?? null;
  const restaurantId = items[0]?.restaurant_id ?? null;

  /** Soft reconcile — optimistic data already updated; avoid refetch storms. */
  const reconcile = () => {
    void queryClient.invalidateQueries({ queryKey: cartQueryKey, refetchType: 'none' });
  };

  const addItem = useMutation({
    mutationFn: (input: {
      menuItemId: string;
      restaurantId: string;
      quantity?: number;
      preview?: CartItemPreview;
    }) => {
      if (!customerId) throw new Error('Not signed in.');
      return addCartItem({
        customerId,
        menuItemId: input.menuItemId,
        restaurantId: input.restaurantId,
        quantity: input.quantity ?? 1,
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previous = queryClient.getQueryData<CartLine[]>(cartQueryKey) ?? [];
      const mixed = previous.some((line) => line.restaurant_id !== input.restaurantId);
      if (mixed || !customerId) return { previous, skipped: true };
      const count = Math.max(1, input.quantity ?? 1);
      const existing = previous.find((line) => line.menu_item_id === input.menuItemId);
      const next = existing
        ? previous.map((line) =>
            line.menu_item_id === input.menuItemId ? { ...line, quantity: line.quantity + count } : line,
          )
        : input.preview
          ? [
              ...previous,
              {
                ...pendingLine(customerId, input.menuItemId, input.restaurantId, input.preview),
                quantity: count,
              },
            ]
          : previous;
      queryClient.setQueryData(cartQueryKey, next);
      return { previous, skipped: false };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(cartQueryKey, context.previous);
      if (!context?.skipped) alertCartError(error);
    },
    onSuccess: async (_data, input, context) => {
      // Mixed-restaurant path skipped optimistic update — pull truth once.
      if (context?.skipped) {
        await queryClient.invalidateQueries({ queryKey: cartQueryKey });
        return;
      }
      // Replace pending ids with server rows when we added a new line without a stable id.
      if (input.preview && !(queryClient.getQueryData<CartLine[]>(cartQueryKey) ?? []).some((l) => l.id.startsWith('pending-'))) {
        reconcile();
        return;
      }
      if ((queryClient.getQueryData<CartLine[]>(cartQueryKey) ?? []).some((l) => l.id.startsWith('pending-'))) {
        await queryClient.invalidateQueries({ queryKey: cartQueryKey });
      }
    },
  });

  const updateQuantity = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      setCartQuantity(id, quantity, customerId ?? undefined),
    onMutate: async ({ id, quantity }) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previous = queryClient.getQueryData<CartLine[]>(cartQueryKey) ?? [];
      const next =
        quantity < 1
          ? previous.filter((line) => line.id !== id)
          : previous.map((line) => (line.id === id ? { ...line, quantity } : line));
      queryClient.setQueryData(cartQueryKey, next);
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(cartQueryKey, context.previous);
      alertCartError(error);
    },
  });

  const clear = useMutation({
    mutationFn: () => {
      if (!customerId) throw new Error('Not signed in.');
      return clearCart(customerId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previous = queryClient.getQueryData<CartLine[]>(cartQueryKey) ?? [];
      queryClient.setQueryData(cartQueryKey, []);
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(cartQueryKey, context.previous);
      alertCartError(error);
    },
  });

  return {
    ...query,
    items,
    itemCount,
    subtotal,
    offerPercent,
    discountAmount,
    discountedSubtotal,
    deliveryFee,
    total,
    restaurantName,
    restaurantId,
    addItem,
    updateQuantity,
    clear,
  };
}

function pendingLine(
  customerId: string,
  menuItemId: string,
  restaurantId: string,
  preview: CartItemPreview,
): CartLine {
  const now = new Date().toISOString();
  return {
    id: `pending-${menuItemId}`,
    created_at: now,
    updated_at: now,
    customer_id: customerId,
    restaurant_id: restaurantId,
    menu_item_id: menuItemId,
    quantity: 1,
    menu_items: {
      id: menuItemId,
      name: preview.name,
      price: preview.price,
      image_url: preview.imageUrl,
      is_available: preview.isAvailable,
      is_veg: preview.isVeg,
    },
    restaurants: {
      id: restaurantId,
      name: preview.restaurantName,
      is_open: preview.isOpen,
      offer_percent: null,
    },
  };
}
