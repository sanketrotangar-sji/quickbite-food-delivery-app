import { Alert } from 'react-native';

import { useCart, type CartItemPreview } from '@/hooks/useCart';
import { useCartReplacePrompt } from '@/hooks/useCartReplacePrompt';
import type { HomeDish } from '@/lib/home-mock';

export function useAddDish() {
  const cart = useCart();
  const replace = useCartReplacePrompt();

  async function addDish(dish: HomeDish) {
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
      Alert.alert('Could not add', error instanceof Error ? error.message : 'Try again.');
    }
  }

  return { addDish, adding: cart.addItem.isPending || replace.prompting, dialog: replace.dialog };
}
