import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner-native';
import { router } from 'expo-router';

import { addCartItem } from '@quickbite/api/mobile/cart';
import { useAuth } from '@/hooks/useAuth';
import type { CartItemPreview } from '@/features/cart/useCart';
import type { HomeDish } from '@/lib/home-catalog';

export type PendingAuthAction =
  | {
      type: 'add_dish';
      dish: HomeDish;
      quantity?: number;
    }
  | {
      type: 'add_cart_item';
      menuItemId: string;
      restaurantId: string;
      preview: CartItemPreview;
      quantity?: number;
    }
  | {
      type: 'toggle_heart';
      id: string;
    }
  | {
      type: 'navigate';
      returnTo: string;
    };

type RequireAuthOptions = {
  pendingAction?: PendingAuthAction;
  returnTo?: string;
  message?: string;
  onAuthenticated?: () => void | Promise<void>;
};

type AuthGateContextValue = {
  isAuthed: boolean;
  requireAuth: (options: RequireAuthOptions) => boolean;
  pendingAction: PendingAuthAction | null;
  setPendingAction: (action: PendingAuthAction | null) => void;
  executePendingAction: (userId: string) => Promise<boolean>;
  clearPendingAction: () => void;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [pendingAction, setPendingActionState] = useState<PendingAuthAction | null>(null);
  const pendingActionRef = useRef<PendingAuthAction | null>(null);
  const returnToRef = useRef<string | null>(null);

  const isAuthed = Boolean(session);

  const setPendingAction = useCallback((action: PendingAuthAction | null) => {
    pendingActionRef.current = action;
    setPendingActionState(action);
  }, []);

  const clearPendingAction = useCallback(() => {
    pendingActionRef.current = null;
    returnToRef.current = null;
    setPendingActionState(null);
  }, []);

  const requireAuth = useCallback(
    ({ pendingAction: action, returnTo, message, onAuthenticated }: RequireAuthOptions): boolean => {
      if (session) {
        if (onAuthenticated) void onAuthenticated();
        return true;
      }

      if (action) {
        pendingActionRef.current = action;
        setPendingActionState(action);
      }
      if (returnTo) {
        returnToRef.current = returnTo;
      }

      router.push({
        pathname: '/(auth)/login',
        params: {
          returnTo: returnTo ?? undefined,
          message: message ?? undefined,
        },
      });
      return false;
    },
    [session],
  );

  const executePendingAction = useCallback(
    async (userId: string): Promise<boolean> => {
      const action = pendingActionRef.current;
      const targetReturn = returnToRef.current;
      clearPendingAction();

      if (!action) {
        if (targetReturn) {
          router.replace(targetReturn as never);
          return true;
        }
        return false;
      }

      try {
        if (action.type === 'add_dish') {
          await addCartItem({
            customerId: userId,
            menuItemId: action.dish.id,
            restaurantId: action.dish.restaurantId,
            quantity: action.quantity ?? 1,
          });
          toast.success(`Added ${action.dish.name} to your cart`);
        } else if (action.type === 'add_cart_item') {
          await addCartItem({
            customerId: userId,
            menuItemId: action.menuItemId,
            restaurantId: action.restaurantId,
            quantity: action.quantity ?? 1,
          });
          toast.success(`Added ${action.preview.name} to your cart`);
        }
      } catch (error) {
        console.warn('Could not execute pending action after login:', error);
      }

      if (targetReturn) {
        router.replace(targetReturn as never);
        return true;
      }

      return false;
    },
    [clearPendingAction],
  );

  return (
    <AuthGateContext.Provider
      value={{
        isAuthed,
        requireAuth,
        pendingAction,
        setPendingAction,
        executePendingAction,
        clearPendingAction,
      }}>
      {children}
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error('useAuthGate must be used inside AuthGateProvider');
  return ctx;
}
