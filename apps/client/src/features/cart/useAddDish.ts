
import { userFacingMessage } from '@quickbite/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useAuthGate } from '@/features/auth/hooks';
import { useCart, type CartItemPreview } from '@/features/cart/useCart';
import { useCartReplacePrompt } from '@/features/cart/useCartReplacePrompt';
import { useDeliveryRangeGuard } from '@/features/cart/useDeliveryRangeGuard';
import type { HomeDish } from '@/lib/home-catalog';
import { toast } from 'sonner-native';

export function useAddDish() {
  const { session } = useAuth();
  const { requireAuth } = useAuthGate();
  const cart = useCart();
  const replace = useCartReplacePrompt();
  const { ensureDeliverable } = useDeliveryRangeGuard();

  async function addDish(dish: HomeDish) {
    if (!session) {
      requireAuth({
        pendingAction: { type: 'add_dish', dish },
        message: 'Sign in to add dishes to your cart',
      });
      return;
    }

    if (!ensureDeliverable(dish.restaurantId, { name: dish.restaurantName })) return;
    const input = {
      menuItemId: dish.id,
      restaurantId: dish.restaurantId,
      preview: {
        name: dish.name,
        price: dish.price,
        imageUrl: dish.imageUrl || null,
        isAvailable: true,
        isVeg: dish.veg,
        restaurantName: dish.restaurantName,
        isOpen: true,
      } satisfies CartItemPreview,
    };
    try {
      await replace.runWithReplacePrompt(() => cart.addItem.mutateAsync(input));
    } catch (error) {
      toast.error('Could not add', { description: userFacingMessage(error) });
    }
  }

  return { addDish, adding: cart.addItem.isPending || replace.prompting, dialog: replace.dialog };
}
