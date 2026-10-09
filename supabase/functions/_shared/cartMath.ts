/** Shared cart money math — must match useCart + place_order + rio_snapshot. */

export const STANDARD_DELIVERY_FEE = 40;
export const DELIVERY_MAX_KM = 8;

export function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export function cartTotals(subtotal: number, offerPercent: number, hasLines: boolean) {
  const offer = Math.max(0, Math.min(100, offerPercent));
  const discountAmount = offer > 0 ? money(subtotal * (offer / 100)) : 0;
  const discountedSubtotal = money(Math.max(0, subtotal - discountAmount));
  const deliveryFee = hasLines ? STANDARD_DELIVERY_FEE : 0;
  const total = money(discountedSubtotal + deliveryFee);
  return { offerPercent: offer, discountAmount, discountedSubtotal, deliveryFee, total };
}

export function inDeliveryRange(dropKm: number | null | undefined, maxKm = DELIVERY_MAX_KM): boolean | null {
  if (dropKm == null || !Number.isFinite(dropKm)) return null;
  return dropKm <= maxKm;
}

/** Stable fingerprint for confirm-order integrity (sorted lines + kitchen + totals). */
export function cartFingerprint(input: {
  restaurantId: string;
  lines: { menuItemId: string; quantity: number }[];
  total: number;
}): string {
  const lines = [...input.lines]
    .map((line) => `${line.menuItemId}:${line.quantity}`)
    .sort()
    .join("|");
  return `${input.restaurantId}|${lines}|${money(input.total)}`;
}

export async function cartHash(input: {
  restaurantId: string;
  lines: { menuItemId: string; quantity: number }[];
  total: number;
}): Promise<string> {
  const raw = cartFingerprint(input);
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
