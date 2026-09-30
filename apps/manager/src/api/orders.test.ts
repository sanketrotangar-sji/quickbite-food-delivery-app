import { describe, expect, it } from 'vitest';

import { nextKitchenStatus } from './orders';

describe('nextKitchenStatus', () => {
  it('walks kitchen pipeline', () => {
    expect(nextKitchenStatus('placed')).toBe('preparing');
    expect(nextKitchenStatus('preparing')).toBe('ready');
    expect(nextKitchenStatus('delivered')).toBeNull();
  });
});
