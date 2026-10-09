import { createHash } from 'node:crypto';

/** QuickBite datagen namespace (fixed). */
export const DATAGEN_NS = 'a7f3c2e1-9b4d-5e6f-8a1b-2c3d4e5f6789';

/**
 * RFC 4122 UUIDv5 from name + namespace UUID string.
 */
export function uuidv5(name, namespace = DATAGEN_NS) {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  if (nsBytes.length !== 16) throw new Error(`bad namespace: ${namespace}`);
  const hash = createHash('sha1').update(nsBytes).update(String(name), 'utf8').digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export const SYNTHETIC_OWNER_ID = uuidv5('synthetic-owner-v1');
export const SYNTHETIC_OWNER_EMAIL = 'synthetic-owner@quickbite.synthetic';

export function restaurantId(slug) {
  return uuidv5(`restaurant:${slug}`);
}

export function menuItemId(restaurantSlug, canonicalKey) {
  return uuidv5(`${restaurantSlug}:${canonicalKey}`);
}
