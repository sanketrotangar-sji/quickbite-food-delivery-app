import { Alert } from 'react-native';

import { userFacingMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useCart, type CartItemPreview } from '@/hooks/useCart';
import { useCartReplacePrompt } from '@/hooks/useCartReplacePrompt';
import { useDeliveryRangeGuard } from '@/hooks/useDeliveryRangeGuard';
import type { HomeDish } from '@/lib/home-catalog';

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
      Alert.alert('Could not add', userFacingMessage(error));
    }
  }

  return { addDish, adding: cart.addItem.isPending || replace.prompting, dialog: replace.dialog };
}
