/**
 * Shared guardrails for multi-agent RIO: PII redaction, tool-arg validation,
 * and low-confidence refuse / clarify helpers.
 */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Phone-like runs with optional spaces/dashes (10+ digits overall). */
const PHONE_RE = /(?:\+?\d[\d\s().-]{8,}\d)/g;
const LONG_DIGIT_RE = /\b\d{10,15}\b/g;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const LOW_CONFIDENCE_THRESHOLD = 0.55;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Mask phones / emails / long digit runs before model context or structured logs. */
export function redactPii(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL_RE, "[email]")
    .replace(PHONE_RE, "[phone]")
    .replace(LONG_DIGIT_RE, "[number]");
}

export function redactPiiDeep(value: unknown): unknown {
  if (typeof value === "string") return redactPii(value);
  if (Array.isArray(value)) return value.map(redactPiiDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactPiiDeep(v);
    }
    return out;
  }
  return value;
}

export type ToolValidation =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: "INVALID_ARGS"; message: string; instruction: string };

function fail(message: string, instruction: string): ToolValidation {
  return { ok: false, error: "INVALID_ARGS", message, instruction };
}

/** Validate tool args before RPC / DB work. Unknown tools pass through (runTool handles). */
export function validateToolArgs(
  name: string,
  raw: Record<string, unknown>,
): ToolValidation {
  const args = raw && typeof raw === "object" ? { ...raw } : {};

  switch (name) {
    case "browse_themes":
      return { ok: true, args };

    case "find_offers":
    case "find_food":
    case "verify_dish": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query) {
        return fail(
          "query is required.",
          "Ask for a dish or theme, then call find_offers again.",
        );
      }
      args.query = query.slice(0, 120);
      if (args.restaurant_id != null && !isUuid(args.restaurant_id)) {
        return fail("restaurant_id must be a uuid.", "Omit restaurant_id or pass a valid id.");
      }
      return { ok: true, args };
    }

    case "get_menu":
      if (!isUuid(args.restaurant_id)) {
        return fail(
          "restaurant_id is required.",
          "Pick a kitchen card first, then call get_menu with its id.",
        );
      }
      return { ok: true, args };

    case "cart": {
      const op = typeof args.op === "string" ? args.op : "";
      if (!["view", "add", "set_qty"].includes(op)) {
        return fail(
          "cart op must be view, add, or set_qty.",
          "Call cart with a valid op.",
        );
      }
      if (op === "add" && !isUuid(args.menu_item_id)) {
        return fail(
          "menu_item_id is required for add.",
          "Use a menu item id from get_menu or find_offers.",
        );
      }
      if (op === "set_qty") {
        if (!isUuid(args.menu_item_id)) {
          return fail("menu_item_id is required for set_qty.", "Pass the cart line menu_item_id.");
        }
        if (typeof args.quantity !== "number" || !Number.isFinite(args.quantity)) {
          return fail("quantity must be a number.", "Pass quantity (0 removes).");
        }
      }
      return { ok: true, args };
    }

    case "checkout":
    case "place_order":
    case "reorder_last":
      return { ok: true, args };

    case "order_status":
    case "estimate_eta":
      if (args.order_id != null && !isUuid(args.order_id)) {
        return fail(
          "order_id must be a uuid when provided.",
          "Omit order_id for the latest order, or pass a valid id.",
        );
      }
      return { ok: true, args };

    case "report_issue": {
      const issueType = typeof args.issue_type === "string" ? args.issue_type.trim() : "";
      const description = typeof args.description === "string" ? args.description.trim() : "";
      if (!issueType || !description) {
        return fail(
          "issue_type and description are required.",
          "Ask what went wrong, then call report_issue.",
        );
      }
      args.issue_type = issueType.slice(0, 80);
      args.description = description.slice(0, 1000);
      if (args.order_id != null && !isUuid(args.order_id)) {
        return fail("order_id must be a uuid when provided.", "Omit order_id or pass a valid id.");
      }
      return { ok: true, args };
    }

    case "save_prefs":
      return { ok: true, args };

    default:
      return { ok: true, args };
  }
}

export function shouldClarify(confidence: number, threshold = LOW_CONFIDENCE_THRESHOLD): boolean {
  return !(confidence >= threshold);
}

export function clarifyReply(_reason?: string): string {
  // Never leak internal route reasons to the customer.
  return "What are you craving — a dish, a cuisine, or should I show popular picks nearby?";
}
