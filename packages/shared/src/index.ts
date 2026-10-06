/** Shared types and pure rules — keep in sync with Supabase enums. */

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

/** Shared vocabulary for customer / rider / kitchen surfaces. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export {
  computeBumpedEta,
  hasRole,
  isAdmin,
  isKitchenStatus,
  isPartner,
  nextKitchenStatus,
  nextRiderStatus,
  pickNearestRider,
  shouldRunKitchenLoadBump,
  ticketUrgency,
  validateAuthForm,
  type RiderCandidate,
  type TicketUrgency,
} from "../../../supabase/functions/_shared/rules.ts";

export { brandHex, brandOklchNotes } from "./brand-tokens";
