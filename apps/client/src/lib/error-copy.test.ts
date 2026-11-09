import { describe, expect, it, vi } from 'vitest';

vi.mock('@quickbite/api/errors', () => ({
  userFacingMessage: (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong. Try again.'),
}));
vi.mock('@/lib/rio-errors', () => ({ userFacingRioError: () => 'rio' }));

import { errorCopy } from './error-copy';

describe('errorCopy', () => {
  it('maps RPC codes in the message', () => {
    expect(errorCopy(new Error('DELIVERY_RANGE: 9.2 km')).code).toBe('DELIVERY_RANGE');
    expect(errorCopy(new Error('ITEM_UNAVAILABLE')).title).toBe('Item sold out');
  });

  it('maps network failures', () => {
    expect(errorCopy(new Error('Network request failed')).code).toBe('NETWORK');
  });

  it('falls back to the raw message with the given title', () => {
    const copy = errorCopy(new Error('Kitchen paused'), 'Could not place order');
    expect(copy).toEqual({ code: 'UNKNOWN', title: 'Could not place order', message: 'Kitchen paused' });
  });
});
