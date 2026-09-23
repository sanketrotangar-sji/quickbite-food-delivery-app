import type { OrderStatus } from '@/constants/orderStatus';

export function riderTrackingAction(
  status: OrderStatus | undefined,
  riderId: string | null | undefined,
  currentUserId: string,
): 'start' | 'stop' | 'ignore' {
  if (riderId !== currentUserId) return 'ignore';
  if (status === 'preparing' || status === 'ready' || status === 'out_for_delivery') {
    return 'start';
  }
  if (status === 'delivered' || status === 'cancelled') return 'stop';
  return 'ignore';
}
