/** OpenAI-style tool definitions shared across specialists. */

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const ALL_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "browse_themes",
      description:
        "List popular food themes from open kitchens in delivery range. ONLY for vague asks like I'm hungry / surprise me. If the customer already named a dish or cuisine, call find_offers instead — do not browse_themes first.",
      parameters: {
        type: "object",
        properties: { veg_only: { type: "boolean" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_offers",
      description:
        "Search per-kitchen offers for a dish or cuisine the customer named. Prefer this over browse_themes whenever they said a concrete food. One featured dish per kitchen. Open + in-range first with restaurant cards (distanceKm).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          veg_only: { type: "boolean" },
          max_price: { type: "number" },
          exclude_restaurant_ids: { type: "array", items: { type: "string" } },
          restaurant_id: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_dish",
      description:
        "Check whether a named kitchen has a dish (available, unavailable, closed, out of range, not on menu).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          restaurant_id: { type: "string" },
          restaurant_name: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_food",
      description: "Legacy alias for find_offers. Prefer find_offers or browse_themes.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          veg_only: { type: "boolean" },
          max_price: { type: "number" },
          exclude_restaurant_ids: { type: "array", items: { type: "string" } },
          restaurant_id: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_menu",
      description: "Load the available menu for one restaurant after the customer picks a kitchen.",
      parameters: {
        type: "object",
        properties: { restaurant_id: { type: "string" } },
        required: ["restaurant_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cart",
      description: "View cart, add a menu item, or set quantity (0 removes). One kitchen per cart.",
      parameters: {
        type: "object",
        properties: {
          op: { type: "string", enum: ["view", "add", "set_qty"] },
          menu_item_id: { type: "string" },
          quantity: { type: "number" },
        },
        required: ["op"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkout",
      description:
        "Show cart totals + Confirm card. Prefer place_order when the customer already said place / proceed / confirm / order now.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "place_order",
      description:
        "Place the current cart now (customer said place / proceed / confirm / order it). Requires a delivery address. Do not use if cart is empty — cart-add first.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "order_status",
      description: "Read order status and history. Omit order_id for latest orders.",
      parameters: {
        type: "object",
        properties: { order_id: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_eta",
      description:
        "Estimate delivery travel time for an order (kitchen → drop-off) via Maps/ORS with OSRM fallback. Omit order_id for latest active order.",
      parameters: {
        type: "object",
        properties: { order_id: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_issue",
      description: "Open a support ticket. order_id optional.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          issue_type: { type: "string" },
          description: { type: "string" },
        },
        required: ["issue_type", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reorder_last",
      description: "Rebuild cart from the latest delivered order, then use checkout.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "save_prefs",
      description:
        "Save durable preferences (diet, spice, budget, cuisines, avoid, notes). Survives New chat.",
      parameters: {
        type: "object",
        properties: {
          diet: { type: "string", description: "veg | non_veg | any | eggetarian" },
          spice: { type: "string", description: "mild | medium | spicy | any" },
          budget_max: { type: "number" },
          cuisines_like: { type: "array", items: { type: "string" } },
          avoid: { type: "array", items: { type: "string" } },
          notes: { type: "string" },
        },
      },
    },
  },
];

export function toolsForNames(names: string[]): ToolDef[] {
  const allow = new Set(names);
  return ALL_TOOLS.filter((t) => allow.has(t.function.name));
}
