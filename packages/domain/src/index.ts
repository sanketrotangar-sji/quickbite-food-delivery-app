/** Pure domain rules — keep in sync with Supabase enums. */

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
  distanceKm,
  formatKm,
  formatOrderCode,
  getDisplayImageUrl,
  hasRole,
  haversineKm,
  isAdmin,
  isKitchenStatus,
  isPartner,
  nextKitchenStatus,
  nextRiderStatus,
  pickNearestRider,
  shortOrderId,
  shouldRunKitchenLoadBump,
  ticketUrgency,
  validateAuthForm,
  type ImageSlot,
  type RiderCandidate,
  type TicketUrgency,
} from "../../../supabase/functions/_shared/rules";

export {
  cartFingerprint,
  cartHash,
  cartTotals,
  DELIVERY_MAX_KM,
  inDeliveryRange,
  money,
  STANDARD_DELIVERY_FEE,
} from "../../../supabase/functions/_shared/cartMath";

export { brandHex, brandOklchNotes, motion, typeScale } from "./brand-tokens";

export {
  countByKey,
  countByStatus,
  percentile,
  summarizeOrderPipeline,
  summarizeRioTurns,
  type CountBucket,
  type OrderPipelineSummary,
  type OrderStatusCount,
  type RioTurnSummary,
} from "./ops-metrics";

export {
  resolveCheckoutOffer,
  type CheckoutOfferInput,
  type CheckoutOfferResult,
} from "./checkout-offer";

export {
  buildVisionSearchQuery,
  CANONICAL_CATEGORIES,
  CANONICAL_FOOD_TAGS,
  computeRetrievalMetrics,
  computeTagPRF1,
  inferAttributesFromText,
  normalizeFoodTags,
  normalizeMenuCategory,
  normalizeSpiceLevel,
  validateImageDataUrl,
  type CanonicalFoodTag,
  type CanonicalMenuCategory,
  type ImageValidationResult,
  type SpiceLevel,
  type VisionAnalysis,
} from "./vision";

