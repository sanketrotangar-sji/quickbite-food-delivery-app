import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

export function useCart() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const customerId = session?.user.id;

  const query = useQuery({
    queryKey: cartQueryKey,
    queryFn: listCart,
    enabled: !!customerId,
  });

  const items = query.data ?? [];
  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = items.reduce((sum, line) => sum + line.quantity * Number(line.menu_items?.price ?? 0), 0);
  const deliveryFee = itemCount > 0 ? STANDARD_DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;
  const restaurantName = items[0]?.restaurants?.name ?? null;
  const restaurantId = items[0]?.restaurant_id ?? null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: cartQueryKey });

  const addItem = useMutation({
    mutationFn: (input: { menuItemId: string; restaurantId: string; preview?: CartItemPreview }) => {
      if (!customerId) throw new Error('Not signed in.');
      return addCartItem({
        customerId,
        menuItemId: input.menuItemId,
        restaurantId: input.restaurantId,
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previous = queryClient.getQueryData<CartLine[]>(cartQueryKey) ?? [];
      const mixed = previous.some((line) => line.restaurant_id !== input.restaurantId);
      if (mixed || !customerId) return { previous, skipped: true };
      const existing = previous.find((line) => line.menu_item_id === input.menuItemId);
      const next = existing
        ? previous.map((line) =>
            line.menu_item_id === input.menuItemId ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : input.preview
          ? [...previous, pendingLine(customerId, input.menuItemId, input.restaurantId, input.preview)]
          : previous;
      queryClient.setQueryData(cartQueryKey, next);
      return { previous, skipped: false };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(cartQueryKey, context.previous);
    },
    onSettled: invalidate,
  });

  const updateQuantity = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => setCartQuantity(id, quantity),
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
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(cartQueryKey, context.previous);
    },
    onSettled: invalidate,
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
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(cartQueryKey, context.previous);
    },
    onSettled: invalidate,
  });

  return {
    ...query,
    items,
    itemCount,
    subtotal,
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
    },
  };
}
