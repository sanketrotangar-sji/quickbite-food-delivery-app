import { describe, expect, it, vi } from 'vitest';

import { bindSupabase } from '@quickbite/api';
import { uploadMenuThumb } from '@quickbite/api/dashboard/menu';
import { nextKitchenStatus } from '@quickbite/domain';

describe('nextKitchenStatus (manager kitchen advance)', () => {
  it('advances placed → preparing → ready and rejects non-kitchen statuses', () => {
    expect(nextKitchenStatus('placed')).toBe('preparing');
    expect(nextKitchenStatus('preparing')).toBe('ready');
    expect(nextKitchenStatus('ready')).toBeNull();
    expect(nextKitchenStatus('out_for_delivery')).toBeNull();
    expect(nextKitchenStatus('delivered')).toBeNull();
    expect(nextKitchenStatus('cancelled')).toBeNull();
  });
});

describe('uploadMenuThumb', () => {
  it('rewrites extension to .sm.webp and uploads with image/webp content type', async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: 'r1/dish.sm.webp' }, error: null });
    const from = vi.fn(() => ({ upload }));
    bindSupabase({ storage: { from } } as any);

    const blob = new Blob(['webp'], { type: 'image/webp' });
    await uploadMenuThumb('r1/dish.JPG', blob);

    expect(from).toHaveBeenCalledWith('menu-images');
    expect(upload).toHaveBeenCalledWith('r1/dish.sm.webp', blob, {
      contentType: 'image/webp',
      upsert: true,
    });
  });
});
