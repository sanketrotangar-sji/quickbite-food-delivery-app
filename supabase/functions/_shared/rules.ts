/** Pure business rules — tested by Deno/Vitest; safe to import from edge functions. */

export type AppRole =
  | "customer"
  | "restaurant_manager"
  | "restaurant_owner"
  | "rider"
  | "admin";

export type OrderStatus =
  | "placed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type TicketUrgency = "low" | "medium" | "high";

export function hasRole(
  profile: { role: AppRole } | null | undefined,
  role: AppRole,
): boolean {
  return profile?.role === role;
}

export function isPartner(profile: { role: AppRole } | null | undefined): boolean {
  return hasRole(profile, "restaurant_owner") || hasRole(profile, "restaurant_manager");
}

export function isAdmin(profile: { role: AppRole } | null | undefined): boolean {
  return hasRole(profile, "admin");
}

export function ticketUrgency(issueType: string, description: string): TicketUrgency {
  const blob = `${issueType} ${description}`.toLowerCase();
  if (/\b(never arrived|not arrived|missing|wrong order|food poisoning|unsafe|allergen|harass)\b/.test(blob)) {
    return "high";
  }
  if (/\b(late|delay|cold|spill|damaged|refund|cancel)\b/.test(blob)) {
    return "medium";
  }
  return "low";
}

const KITCHEN_STATUSES: OrderStatus[] = ["placed", "preparing", "ready"];

export function isKitchenStatus(status: OrderStatus): status is "placed" | "preparing" | "ready" {
  return (KITCHEN_STATUSES as string[]).includes(status);
}

export function nextKitchenStatus(status: OrderStatus): "preparing" | "ready" | null {
  if (status === "placed") return "preparing";
  if (status === "preparing") return "ready";
  return null;
}

/** Rider-legal advance: ready → out_for_delivery → delivered. */
export function nextRiderStatus(status: OrderStatus): "out_for_delivery" | "delivered" | null {
  if (status === "ready") return "out_for_delivery";
  if (status === "out_for_delivery") return "delivered";
  return null;
}

/** Client-side auth form checks before calling Supabase Auth. */
export function validateAuthForm(input: {
  email: string;
  password: string;
  fullName?: string;
  requireName?: boolean;
}): string | null {
  const email = input.email.trim();
  const password = input.password;
  if (!email || !email.includes("@")) return "Enter a valid email.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (input.requireName && !input.fullName?.trim()) return "Name is required.";
  return null;
}

/** Mirrors kitchen-load cron: skip restaurant when still in cooldown. */
export function shouldRunKitchenLoadBump(
  openOrderCount: number,
  threshold: number,
  cooldownActive: boolean,
): boolean {
  if (cooldownActive) return false;
  return openOrderCount > threshold;
}

export function computeBumpedEta(
  currentEta: number | null,
  prepMinutes: number | null,
  bumpMinutes: number,
): number {
  const base = currentEta ?? prepMinutes ?? 30;
  return base + bumpMinutes;
}

export type RiderCandidate = {
  riderId: string;
  distanceKm: number;
  openLoad: number;
};

/** Same ordering as SQL: nearest distance, then least open load. */
export function pickNearestRider(candidates: RiderCandidate[]): RiderCandidate | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return a.openLoad - b.openLoad;
  });
  return sorted[0] ?? null;
}

/** Great-circle distance in kilometers between lat/lng coordinates. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
}

export function formatKm(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return "—";
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Short 6-character uppercase display ID for an order UUID. */
export function shortOrderId(id: string): string {
  return id.replace(/-/g, "").slice(-6).toUpperCase();
}

/** Order display code: prefers explicit QB... note, else last 6 hex characters of id. */
export function formatOrderCode(id: string, notes?: string | null): string {
  const trimmed = notes?.trim();
  if (trimmed && /^QB\d+$/i.test(trimmed)) return trimmed.toUpperCase();
  return shortOrderId(id);
}

export type ImageSlot = "thumb" | "hero" | "full";

/**
 * Prefer Storage sibling thumbs (`foo.png` -> `foo.sm.webp`) for thumb/hero slots.
 */
export function getDisplayImageUrl(
  url: string | null | undefined,
  slot: ImageSlot = "full",
): string {
  if (!url) return "";
  if (slot === "full") return url;
  if (!url.includes("/storage/v1/object/public/")) return url;
  if (/\.sm\.webp(\?|$)/i.test(url)) return url;
  return url.replace(/\.(png|jpe?g|webp)(\?|$)/i, ".sm.webp$2");
}

