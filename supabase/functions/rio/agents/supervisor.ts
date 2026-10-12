/**
 * Deterministic intent router → specialist agent.
 * Prefer acting on clear food asks; clarify only when truly ambiguous.
 */

import { LOW_CONFIDENCE_THRESHOLD, shouldClarify } from "../guardrails.ts";
import type { AgentId, RouteResult } from "./types.ts";

const DISPATCH_RE =
  /\b(eta|where(?:'s| is)?\s+(?:my\s+)?order|track(?:ing)?|rider|out\s*for\s*delivery|how\s+long|arriv(?:e|ing)|delivery\s+status|on\s+the\s+way|when\s+will)\b/i;

const SUPPORT_RE =
  /\b(refund|complaint|ticket|support|wrong\s+(?:order|food|item)|missing|cold|spoiled|never\s+arrived|damaged|issue|problem|bad\s+food|overcharged)\b/i;

const ORDER_RE =
  /\b(order|hungry|menu|cart|checkout|food|craving|veg|non[\s-]?veg|add|reorder|kitchen|restaurant|dish|meal|cuisine|thali|combo|snack|breakfast|lunch|dinner|dessert|drink|coffee|tea|juice|pizza|burger|pasta|noodles|biryani|dosa|idli|vada|samosa|paneer|chicken|mutton|fish|egg|shawarma|kebab|rolls?|sandwich|wrap|salad|soup|rice|roti|naan|paratha|curry|gravy|chinese|italian|mexican|thai|indian|goan|continental|ice\s*cream|cake|pastry|smoothie|milkshake|momos?|fried\s*rice|manchurian)\b/i;

/** "get me X" / "I want X" without needing a known dish keyword. */
const WANT_FOOD_RE =
  /\b((?:i\s+)?(?:want|wanna|need|craving|looking\s+for|get\s+me|order\s+me|find(?:\s+me)?|search(?:\s+for)?|show(?:\s+me)?|bring\s+me)|(?:something|anything)\s+(?:to\s+eat|spicy|veg|non[\s-]?veg))\b/i;

const GREETING_RE = /^(hi|hello|hey|yo|sup|help|help me)[\s!.?]*$/i;

const VAGUE_ONLY_RE =
  /^(i'?m\s+hungry|hungry|surprise\s+me|anything|something|feed\s+me|idk|i\s+don'?t\s+know)[\s!.?]*$/i;

export type RouteHints = {
  hasActiveOrder?: boolean;
};

export function routeIntent(userText: string, hints: RouteHints = {}): RouteResult {
  const text = userText.trim().slice(0, 500);
  if (!text) {
    return { agent: "clarify", confidence: 0.2, reason: "empty message" };
  }

  const support = SUPPORT_RE.test(text);
  const dispatch = DISPATCH_RE.test(text);
  const order = ORDER_RE.test(text);
  const wantFood = WANT_FOOD_RE.test(text);
  const greeting = GREETING_RE.test(text);
  const vagueOnly = VAGUE_ONLY_RE.test(text);

  if (support && dispatch) {
    return {
      agent: "support",
      confidence: 0.78,
      reason: "complaint language wins over delivery tracking",
    };
  }
  if (support) {
    return { agent: "support", confidence: 0.88, reason: "support / complaint keywords" };
  }
  if (dispatch) {
    const confidence = hints.hasActiveOrder ? 0.9 : 0.72;
    return {
      agent: "dispatch",
      confidence,
      reason: hints.hasActiveOrder
        ? "delivery tracking with active order"
        : "delivery tracking keywords",
    };
  }
  if (order || wantFood) {
    return {
      agent: "order",
      confidence: vagueOnly ? 0.7 : 0.9,
      reason: vagueOnly
        ? "vague hunger — order specialist may browse themes"
        : "clear ordering / food ask",
    };
  }
  if (greeting) {
    // Warm welcome via clarify prompt — not the old three-option automation list.
    return { agent: "clarify", confidence: 0.55, reason: "short greeting" };
  }
  if (hints.hasActiveOrder && text.length < 48) {
    return {
      agent: "dispatch",
      confidence: 0.65,
      reason: "short message with active order — likely status",
    };
  }

  // Default: ordering is the primary product surface — act, don't questionnaire.
  return { agent: "order", confidence: 0.72, reason: "default to order specialist" };
}

/** Apply confidence floor: low confidence → clarify instead of guessing. */
export function finalizeRoute(route: RouteResult): RouteResult {
  if (route.agent === "clarify") return route;
  if (shouldClarify(route.confidence, LOW_CONFIDENCE_THRESHOLD)) {
    return {
      agent: "clarify",
      confidence: route.confidence,
      reason: `low confidence (${route.confidence.toFixed(2)}): ${route.reason}`,
    };
  }
  return route;
}

export function routeTag(route: RouteResult): string {
  return `route:${route.agent}:${route.confidence.toFixed(2)}`;
}

export function isSpecialist(agent: AgentId): agent is Exclude<AgentId, "clarify"> {
  return agent === "order" || agent === "dispatch" || agent === "support";
}
