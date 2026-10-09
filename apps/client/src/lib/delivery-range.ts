import { distanceKm, formatKm } from '@/lib/geo';
import { NEAR_ME_MAX_KM } from '@/lib/explore-filters';

export { NEAR_ME_MAX_KM };

export class DeliveryRangeError extends Error {
  readonly code = 'delivery_range' as const;
  constructor(message: string) {
    super(message);
    this.name = 'DeliveryRangeError';
  }
}

export type DeliveryOrigin = { latitude: number; longitude: number };

export function deliveryOriginFromAddress(
  address: { lat?: number | null; lng?: number | null } | null | undefined,
): DeliveryOrigin | null {
  if (address?.lat == null || address?.lng == null) return null;
  const latitude = Number(address.lat);
  const longitude = Number(address.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Ensures kitchen is within delivery radius of the selected address pin.
 * Missing kitchen coords → skip (cannot invent distance).
 * Missing address pin → block add (need a pin to deliver).
 */
export function assertWithinDeliveryRange(
  origin: DeliveryOrigin | null,
  kitchen: { lat?: number | null; lng?: number | null; name?: string | null },
  maxKm = NEAR_ME_MAX_KM,
): void {
  if (!origin) {
    throw new DeliveryRangeError(
      'Set a delivery address with a location pin first so we can check if this kitchen is in range.',
    );
  }
  if (kitchen.lat == null || kitchen.lng == null) return;
  const km = distanceKm(origin, {
    latitude: Number(kitchen.lat),
    longitude: Number(kitchen.lng),
  });
  if (!Number.isFinite(km)) return;
  if (km <= maxKm) return;
  const label = kitchen.name?.trim() || 'This kitchen';
  throw new DeliveryRangeError(
    `${label} is about ${formatKm(km)} from your address. We only deliver within ${maxKm} km.`,
  );
}
