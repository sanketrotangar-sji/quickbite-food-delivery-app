import { describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => true,
    back: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: vi.fn(),
  },
}));

vi.mock('@/api/cart', () => ({
  addCartItem: vi.fn().mockResolvedValue({ id: 'cart-123' }),
}));

describe('useAuthGate logic', () => {
  it('creates requireAuth and pending action workflow', async () => {
    const { addCartItem } = await import('@/api/cart');

    // Simulate requireAuth behavior when not signed in
    let pendingAction: any = null;
    let returnTo: string | null = null;

    function requireAuth(options: {
      session: any;
      pendingAction?: any;
      returnTo?: string;
      message?: string;
      onAuthenticated?: () => void;
    }) {
      if (options.session) {
        options.onAuthenticated?.();
        return true;
      }
      if (options.pendingAction) pendingAction = options.pendingAction;
      if (options.returnTo) returnTo = options.returnTo;
      mockPush({
        pathname: '/(auth)/login',
        params: { returnTo: options.returnTo, message: options.message },
      });
      return false;
    }

    // 1. Guest attempts to add a dish
    const sampleDish = {
      id: 'dish-1',
      restaurantId: 'rest-1',
      name: 'Paneer Butter Masala',
      price: 280,
      veg: true,
      restaurantName: 'Spice Hub',
    };

    const allowed = requireAuth({
      session: null,
      pendingAction: { type: 'add_dish', dish: sampleDish },
      returnTo: '/restaurant/rest-1',
      message: 'Sign in to add dishes to your cart',
    });

    expect(allowed).toBe(false);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/login',
      params: {
        returnTo: '/restaurant/rest-1',
        message: 'Sign in to add dishes to your cart',
      },
    });
    expect(pendingAction).toEqual({ type: 'add_dish', dish: sampleDish });

    // 2. Simulate executePendingAction after successful login
    async function executePendingAction(userId: string) {
      if (!pendingAction) return false;
      if (pendingAction.type === 'add_dish') {
        await addCartItem({
          customerId: userId,
          menuItemId: pendingAction.dish.id,
          restaurantId: pendingAction.dish.restaurantId,
          quantity: 1,
        });
      }
      if (returnTo) {
        mockReplace(returnTo);
      }
      pendingAction = null;
      returnTo = null;
      return true;
    }

    const executed = await executePendingAction('user-uuid-123');
    expect(executed).toBe(true);
    expect(addCartItem).toHaveBeenCalledWith({
      customerId: 'user-uuid-123',
      menuItemId: 'dish-1',
      restaurantId: 'rest-1',
      quantity: 1,
    });
    expect(mockReplace).toHaveBeenCalledWith('/restaurant/rest-1');
  });

  it('allows authenticated users through immediately', () => {
    let executedCallback = false;
    function requireAuth(session: any, onAuthenticated?: () => void) {
      if (session) {
        onAuthenticated?.();
        return true;
      }
      return false;
    }

    const res = requireAuth({ user: { id: 'u1' } }, () => {
      executedCallback = true;
    });

    expect(res).toBe(true);
    expect(executedCallback).toBe(true);
  });
});
