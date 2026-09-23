import { describe, expect, it } from 'vitest';

import { routeFromNotification } from './routes';

describe('routeFromNotification', () => {
  it('opens the rider delivery pool for new requests', () => {
    expect(routeFromNotification({ audience: 'rider', type: 'new_delivery', orderId: 'order-1' })).toBe(
      '/(rider)/(tabs)',
    );
  });

  it('opens the active rider delivery for assigned updates', () => {
    expect(routeFromNotification({ audience: 'rider', type: 'assigned_order_status' })).toBe(
      '/(rider)/delivery',
    );
  });

  it('opens the matching customer tracking screen', () => {
    expect(routeFromNotification({ audience: 'customer', orderId: 'order-1' })).toEqual({
      pathname: '/(customer)/orders/[id]',
      params: { id: 'order-1' },
    });
  });

  it('ignores payloads without a destination', () => {
    expect(routeFromNotification({ type: 'marketing' })).toBeNull();
  });
});
