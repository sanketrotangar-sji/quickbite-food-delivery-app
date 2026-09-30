import type { DeliveryCoordinate } from '@/api/deliveries';

/** Great-circle distance in kilometers. */
export function distanceKm(a: DeliveryCoordinate, b: DeliveryCoordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatKm(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return '—';
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
