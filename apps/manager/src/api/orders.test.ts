import { describe, expect, it } from 'vitest';

import { nextKitchenStatus } from './orders';

describe('nextKitchenStatus (manager kitchen advance)', () => {
  it('advances placed → preparing → ready only', () => {
    expect(nextKitchenStatus('placed')).toBe('preparing');
    expect(nextKitchenStatus('preparing')).toBe('ready');
    expect(nextKitchenStatus('ready')).toBeNull();
    expect(nextKitchenStatus('delivered')).toBeNull();
  });
});
