import { useState, type ReactElement } from 'react';

import { CartOtherRestaurantError, userFacingMessage } from '@quickbite/api/errors';
import { CartReplaceDialog } from '@/components/CartReplaceDialog';
import { useCart } from '@/features/cart/useCart';
import { toast } from 'sonner-native';

type PromptState = {
  restaurantName: string;
  confirmLabel?: string;
  retry: () => Promise<void>;
};

export function useCartReplacePrompt() {
  const cart = useCart();
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [loading, setLoading] = useState(false);

  function dismiss() {
    if (loading) return;
    setPrompt(null);
  }

  async function runWithReplacePrompt(
    action: () => Promise<void>,
    options?: { confirmLabel?: string; retry?: () => Promise<void> },
  ) {
    try {
      await action();
    } catch (error) {
      if (error instanceof CartOtherRestaurantError) {
        setPrompt({
          restaurantName: error.currentRestaurantName,
          confirmLabel: options?.confirmLabel,
          retry: options?.retry ?? action,
        });
        return;
      }
      throw error;
    }
  }

  async function confirmReplace() {
    if (!prompt) return;
    setLoading(true);
    try {
      await cart.clear.mutateAsync();
      await prompt.retry();
      setPrompt(null);
    } catch (error) {
      toast.error('Could not update cart', { description: userFacingMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  const dialog: ReactElement = (
    <CartReplaceDialog
      visible={prompt != null}
      restaurantName={prompt?.restaurantName ?? ''}
      confirmLabel={prompt?.confirmLabel}
      loading={loading}
      onKeep={dismiss}
      onClearAndAdd={() => {
        void confirmReplace();
      }}
    />
  );

  return { runWithReplacePrompt, dialog, prompting: prompt != null };
}
