/** Shared role + order-status labels — keep in sync with Supabase enums. */

export const APP_ROLES = [
  "customer",
  "restaurant_manager",
  "restaurant_owner",
  "rider",
  "admin",
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ORDER_STATUSES = [
  "placed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
