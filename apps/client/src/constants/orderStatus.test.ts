import { describe, expect, it } from 'vitest';

import { customerActions, isStatusAtLeast, riderActions } from './orderStatus';

describe('customerActions', () => {
  it('allows track except cancelled', () => {
    expect(customerActions('placed').canTrack).toBe(true);
    expect(customerActions('cancelled').canTrack).toBe(false);
  });
  it('allows rate only when delivered', () => {
    expect(customerActions('delivered').canRate).toBe(true);
    expect(customerActions('out_for_delivery').canRate).toBe(false);
  });
});

describe('riderActions', () => {
  it('claim only when unclaimed preparing/ready', () => {
    expect(riderActions('ready', false).canClaim).toBe(true);
    expect(riderActions('ready', true).canClaim).toBe(false);
    expect(riderActions('placed', false).canClaim).toBe(false);
  });
  it('start and deliver follow status', () => {
    expect(riderActions('ready', true).canStartDelivery).toBe(true);
    expect(riderActions('out_for_delivery', true).canMarkDelivered).toBe(true);
  });
});

describe('isStatusAtLeast', () => {
  it('orders statuses', () => {
    expect(isStatusAtLeast('delivered', 'ready')).toBe(true);
    expect(isStatusAtLeast('placed', 'ready')).toBe(false);
    expect(isStatusAtLeast('cancelled', 'placed')).toBe(false);
  });
});
