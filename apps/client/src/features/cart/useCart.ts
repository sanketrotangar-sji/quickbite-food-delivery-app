import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cartTotals } from '@quickbite/domain';
import { addCartItem, clearCart, listCart, setCartQuantity } from '@quickbite/api/mobile/cart';
import { useAuth } from '@/hooks/useAuth';
import type { CartLine } from '@/types/models';
import { toast } from 'sonner-native';
import { queryKeys } from '@/lib/query-keys';

export const cartQueryKey = queryKeys.cart.all;

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
  toast.error('Cart update failed', { description: error instanceof Error ? error.message : 'Try again.' });
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
  const { offerPercent, discountAmount, discountedSubtotal, deliveryFee, total } = cartTotals(
    subtotal,
    Number(items[0]?.restaurants?.offer_percent ?? 0),
    itemCount > 0,
  );
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
      lat: null,
      lng: null,
    },
  };
}
