import { describe, expect, it } from 'vitest';

import { pickActiveCustomerOrder } from './customer-orders';
import type { CustomerOrder } from '@/types/models';

function order(id: string, status: CustomerOrder['status'], placedAt: string) {
  return { id, status, placed_at: placedAt } as CustomerOrder;
}

describe('pickActiveCustomerOrder', () => {
  it('returns the newest non-terminal order', () => {
    const result = pickActiveCustomerOrder([
      order('old-active', 'preparing', '2026-09-23T08:00:00Z'),
      order('delivered', 'delivered', '2026-09-23T10:00:00Z'),
      order('new-active', 'placed', '2026-09-23T09:00:00Z'),
    ]);

    expect(result?.id).toBe('new-active');
  });

  it('returns null when every order is terminal', () => {
    expect(
      pickActiveCustomerOrder([
        order('done', 'delivered', '2026-09-23T09:00:00Z'),
        order('cancelled', 'cancelled', '2026-09-23T10:00:00Z'),
      ]),
    ).toBeNull();
  });
});
