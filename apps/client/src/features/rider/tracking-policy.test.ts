import { describe, expect, it } from 'vitest';

import { riderTrackingAction } from './tracking-policy';

describe('riderTrackingAction', () => {
  it.each(['preparing', 'ready', 'out_for_delivery'] as const)(
    'starts or keeps tracking for an assigned %s order',
    (status) => {
      expect(riderTrackingAction(status, 'rider-1', 'rider-1')).toBe('start');
    },
  );

  it.each(['delivered', 'cancelled'] as const)('stops tracking at %s', (status) => {
    expect(riderTrackingAction(status, 'rider-1', 'rider-1')).toBe('stop');
  });

  it('ignores another rider’s order', () => {
    expect(riderTrackingAction('out_for_delivery', 'rider-2', 'rider-1')).toBe('ignore');
  });
});
