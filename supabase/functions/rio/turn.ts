import { callLLM, llmFailureMessage, streamLLM } from "../_shared/llm.ts";
import { dispatchAgent } from "./agents/dispatch.ts";
import { orderAgent } from "./agents/rioOrder.ts";
import { isSpecialist, routeTag } from "./agents/supervisor.ts";
import { CLARIFY_SYSTEM, supportAgent } from "./agents/support.ts";
import { toolsForNames, type ToolDef } from "./agents/toolDefs.ts";
import type { RouteResult, SpecialistDef } from "./agents/types.ts";
import {
  clarifyReply,
  redactPii,
  redactPiiDeep,
  validateToolArgs,
} from "./guardrails.ts";
import { emitTokenChunks, type RioTurnReply } from "./stream.ts";
import {
  addToCart,
  browseThemes,
  checkDeliveryStatus,
  escalateComplaint,
  estimateEta,
  findOffers,
  getMenu,
  isUuid,
  placeCustomerOrder,
  reorderLast,
  requestCheckout,
  trackOrder,
  updateCartQuantity,
  verifyDish,
  viewCart,
  type RioCard,
  type RioConflict,
  type ToolOutcome,
} from "./tools.ts";

export const SPECIALISTS: Record<string, SpecialistDef> = {
  order: orderAgent,
  dispatch: dispatchAgent,
  support: supportAgent,
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const ADD_INTENT = /^add menu item ([0-9a-f-]{36})\b/i;

export function snapshotHasActiveOrder(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const s = snapshot as Record<string, unknown>;
  if (s.active_order || s.activeOrder) return true;
  const orders = s.orders ?? s.active_orders;
  if (Array.isArray(orders) && orders.length > 0) return true;
  const status = s.order_status ?? s.latest_order_status;
  if (typeof status === "string") {
    return ["placed", "preparing", "ready", "out_for_delivery"].includes(status);
  }
  return Boolean(s.has_active_order);
}

export function buildSpecialistSystem(
  specialist: SpecialistDef,
  context: string,
  snapshot: unknown,
  route: RouteResult,
): string {
  let system = specialist.systemPrompt;
  if (context) {
    system =
      `${system}\n\nRecent cards the customer can already see (ranks, featuredDishId, menu ids). If they say "that/first/order it/proceed", use these ids — do not ask them to restate the dish.\n${context}`;
  }
  if (snapshot) {
    const summary = JSON.stringify(redactPiiDeep(snapshot)).slice(0, 3500);
    system =
      `${system}\n\nLIVE CUSTOMER SNAPSHOT (server-owned; trust this over guessing). Refresh with tools only if you change cart/order state.\n${summary}`;
  }
  return (
    `${system}\n\nSupervisor route: ${route.agent} (confidence ${route.confidence.toFixed(2)}; ${route.reason}). Stay in this specialty.`
  );
}

export function replyForAdd(outcome: ToolOutcome): RioTurnReply {
  if (outcome.conflict) {
    return {
      text: `Your cart is from ${outcome.conflict.currentRestaurant}. One kitchen per order — checkout this cart then order ${outcome.conflict.itemName} separately, or Clear & switch.`,
      cards: outcome.cards,
      conflict: outcome.conflict,
    };
  }
  if (typeof outcome.data.error === "string") {
    const detail =
      typeof outcome.data.message === "string" && outcome.data.message.trim()
        ? outcome.data.message
        : outcome.data.error;
    return { text: String(detail), cards: outcome.cards, conflict: null };
  }
  return {
    text: `Added ${String(outcome.data.added ?? "that dish")} to your cart.`,
    cards: outcome.cards,
    conflict: null,
  };
}

export function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const messages: ChatMessage[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim().slice(0, 800);
    if (!text) continue;
    messages.push({ role, content: text });
  }
  while (messages[0]?.role === "assistant") messages.shift();
  return messages.slice(-8);
}

function toolArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // Providers sometimes return a partial arguments string. Treat that as no args.
  }
  return {};
}

function progressForTool(name: string): string {
  switch (name) {
    case "browse_themes":
      return "Looking at what’s popular near you…";
    case "find_offers":
    case "find_food":
      return "Finding kitchens that have that…";
    case "verify_dish":
      return "Checking that kitchen…";
    case "get_menu":
      return "Opening the menu…";
    case "cart":
    case "checkout":
      return "Checking your cart…";
    case "place_order":
      return "Placing your order…";
    case "order_status":
      return "Checking your order…";
    case "estimate_eta":
      return "Estimating delivery time…";
    case "report_issue":
      return "Opening support…";
    case "reorder_last":
      return "Rebuilding your usual order…";
    case "save_prefs":
      return "Saving your preferences…";
    default:
      return "Working…";
  }
}

const CALM_RIO_FAIL =
  "I hit a snag checking that. Want me to try again, pick another kitchen, or open your cart?";

const PLACE_INTENT_RE =
  /^(yes|yeah|yep|ok|okay|sure|go\s*ahead|proceed|place(?:\s+(?:it|order|now))?|order(?:\s+(?:it|now))?|confirm(?:\s+order)?|checkout|do\s+it)[\s!.]*$/i;

const REF_ORDER_RE =
  /\b(order|add|get|want|take|pick|choose|go\s+with)\b.{0,40}\b(that|this|it|first|1st|second|2nd|third|3rd|#?\d+)\b/i;

const RANK_RE = /\b(?:the\s+)?(first|1st|second|2nd|third|3rd|#?([1-9]))\b/i;

type ContextPlace = {
  rank?: number;
  id?: string;
  name?: string;
  dishName?: string;
  featuredDishId?: string | null;
};

function parseContextPlaces(context: string): ContextPlace[] {
  if (!context.trim()) return [];
  try {
    const parsed = JSON.parse(context) as unknown;
    if (!Array.isArray(parsed)) return [];
    const places: ContextPlace[] = [];
    for (const card of parsed) {
      if (!card || typeof card !== "object") continue;
      const kind = (card as { kind?: string }).kind;
      if (kind === "restaurants" && Array.isArray((card as { places?: unknown }).places)) {
        for (const p of (card as { places: ContextPlace[] }).places) {
          places.push(p);
        }
      }
      if (kind === "menu" && Array.isArray((card as { items?: unknown }).items)) {
        const items = (card as { items: { rank?: number; id?: string; name?: string }[] }).items;
        for (const item of items) {
          places.push({
            rank: item.rank,
            featuredDishId: item.id,
            dishName: item.name,
            name: (card as { restaurantName?: string }).restaurantName,
          });
        }
      }
    }
    return places;
  } catch {
    return [];
  }
}

function pickFeaturedDishId(text: string, places: ContextPlace[]): string | null {
  if (!places.length) return null;
  const withDish = places.filter((p) => isUuid(p.featuredDishId));
  if (!withDish.length) return null;

  const rankMatch = text.match(RANK_RE);
  if (rankMatch) {
    const word = (rankMatch[1] || "").toLowerCase();
    const num = rankMatch[2] ? Number(rankMatch[2]) : NaN;
    const rank =
      word === "first" || word === "1st" || num === 1
        ? 1
        : word === "second" || word === "2nd" || num === 2
        ? 2
        : word === "third" || word === "3rd" || num === 3
        ? 3
        : Number.isFinite(num)
        ? num
        : 1;
    const hit = withDish.find((p) => p.rank === rank) ?? withDish[rank - 1];
    return hit?.featuredDishId && isUuid(hit.featuredDishId) ? hit.featuredDishId : null;
  }

  return withDish[0]?.featuredDishId && isUuid(withDish[0].featuredDishId)
    ? withDish[0].featuredDishId
    : null;
}

/** Deterministic follow-ups so "order that" / "proceed" don't get lost in LLM loops. */
export async function tryFollowUpOrder(
  db: any,
  userId: string,
  lastUser: string,
  context: string,
  deliveryAddress: string | null,
  deliveryAddressId: string | null,
  deliveryLat: number | null,
  deliveryLng: number | null,
  notes: string | null,
): Promise<RioTurnReply | null> {
  const text = lastUser.trim();
  if (!text) return null;

  const places = parseContextPlaces(context);
  const cart = await viewCart(db);
  const cartLines = Array.isArray((cart.data as { lines?: unknown })?.lines)
    ? ((cart.data as { lines: unknown[] }).lines)
    : [];
  const hasCart = cartLines.length > 0;

  if (PLACE_INTENT_RE.test(text) && hasCart) {
    const outcome = await placeCustomerOrder(
      db,
      deliveryAddress,
      deliveryAddressId,
      deliveryLat,
      deliveryLng,
      notes,
      null,
    );
    if (typeof outcome.data.error === "string") {
      const msg = String(outcome.data.message ?? outcome.data.error);
      return { text: msg, cards: outcome.cards, conflict: null };
    }
    return {
      text: "Placed. Here's where the order stands.",
      cards: outcome.cards,
      conflict: null,
    };
  }

  if (REF_ORDER_RE.test(text) || (PLACE_INTENT_RE.test(text) && places.length > 0 && !hasCart)) {
    const dishId = pickFeaturedDishId(text, places);
    if (!dishId) return null;
    const added = await addToCart(db, userId, dishId, deliveryLat, deliveryLng);
    if (added.conflict) {
      return {
        text: `Your cart is from ${added.conflict.currentRestaurant}. One kitchen per order — checkout this cart then order ${added.conflict.itemName} separately, or Clear & switch.`,
        cards: added.cards,
        conflict: added.conflict,
      };
    }
    if (typeof added.data.error === "string") {
      return {
        text: String(added.data.message ?? added.data.error),
        cards: added.cards,
        conflict: null,
      };
    }

    if (deliveryAddress || deliveryAddressId) {
      const placed = await placeCustomerOrder(
        db,
        deliveryAddress,
        deliveryAddressId,
        deliveryLat,
        deliveryLng,
        notes,
        null,
      );
      if (typeof placed.data.error !== "string") {
        return {
          text: `Added and placed. Here's where the order stands.`,
          cards: placed.cards,
          conflict: null,
        };
      }
      const checkout = await requestCheckout(db, deliveryAddress, deliveryLat, deliveryLng);
      return {
        text: String(placed.data.message ?? placed.data.error) +
          (checkout.cards.length ? " Confirm below when ready." : ""),
        cards: checkout.cards.length ? checkout.cards : added.cards,
        conflict: null,
      };
    }

    const checkout = await requestCheckout(db, deliveryAddress, deliveryLat, deliveryLng);
    return {
      text: checkout.cards.length
        ? "Added to your cart. Add a delivery address, then confirm to place."
        : "Added to your cart.",
      cards: checkout.cards.length ? checkout.cards : added.cards,
      conflict: null,
    };
  }

  return null;
}

async function logRioEvent(
  db: any,
  userId: string,
  toolsUsed: string[],
  started: number,
  text: string,
  lastProvider: string | null,
  lastModel: string | null,
  turnError: string | null,
) {
  try {
    await db.from("rio_events").insert({
      actor_id: userId,
      provider: lastProvider,
      model: lastModel,
      tools: toolsUsed,
      latency_ms: Date.now() - started,
      token_estimate: Math.round(text.length / 4),
      error: turnError ? redactPii(turnError).slice(0, 240) : null,
    });
  } catch {
    // Observability must not break chat.
  }
}

export async function runClarify(
  db: any,
  userId: string,
  route: RouteResult,
  history: ChatMessage[],
  onToken?: (token: string) => void | Promise<void>,
): Promise<RioTurnReply> {
  const started = Date.now();
  const toolsUsed = [routeTag(route)];
  const fallback = clarifyReply(route.reason);
  let text = fallback;
  let lastProvider: string | null = null;
  let lastModel: string | null = null;

  try {
    const llmHistory = history.map((m) =>
      m.role === "user" ? { ...m, content: redactPii(m.content) } : m
    );
    if (onToken) {
      const streamed = await streamLLM({
        db,
        messages: [
          { role: "system", content: CLARIFY_SYSTEM },
          ...llmHistory.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 200,
        temperature: 0.3,
        onToken: (token) => {
          void onToken(token);
        },
      });
      if (streamed.text.trim()) {
        text = streamed.text.trim();
        lastProvider = streamed.provider;
        lastModel = streamed.model;
      } else {
        await emitTokenChunks(fallback, onToken);
      }
    } else {
      const result = await callLLM({
        db,
        messages: [
          { role: "system", content: CLARIFY_SYSTEM },
          ...llmHistory.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 200,
        temperature: 0.3,
      });
      if (result.response.ok) {
        const content = String(result.payload?.choices?.[0]?.message?.content ?? "").trim();
        if (content) text = content;
        lastProvider = result.provider;
        lastModel = result.model;
      }
    }
  } catch {
    if (onToken && text === fallback) {
      await emitTokenChunks(fallback, onToken);
    }
  }

  await logRioEvent(db, userId, toolsUsed, started, text, lastProvider, lastModel, null);
  return { text, cards: [], conflict: null };
}

export async function runChat(
  db: any,
  userId: string,
  deliveryAddress: string | null,
  deliveryAddressId: string | null,
  deliveryLat: number | null,
  deliveryLng: number | null,
  notes: string | null,
  system: string,
  history: ChatMessage[],
  tools: ToolDef[],
  allowedTools: string[],
  route: RouteResult,
  onToken?: (token: string) => void | Promise<void>,
  onProgress?: (text: string) => void | Promise<void>,
): Promise<RioTurnReply> {
  const messages: Record<string, unknown>[] = [
    { role: "system", content: system },
    ...history.map((message) => ({ role: message.role, content: message.content })),
  ];
  let cards: RioCard[] = [];
  let conflict: RioConflict | null = null;
  const toolsUsed: string[] = [routeTag(route)];
  const started = Date.now();
  let lastProvider: string | null = null;
  let lastModel: string | null = null;
  let turnError: string | null = null;
  let lastToolErrorCode: string | null = null;
  const allow = new Set(allowedTools);

  const finish = async (text: string) => {
    await logRioEvent(db, userId, toolsUsed, started, text, lastProvider, lastModel, turnError);
    return { text, cards: cards.slice(-5), conflict };
  };

  const softFail = async (detail: string) => {
    turnError = detail.slice(0, 240);
    const text =
      cards.length > 0
        ? `${CALM_RIO_FAIL} Showing what I already found.`
        : CALM_RIO_FAIL;
    if (onToken) await emitTokenChunks(text, onToken);
    return finish(text);
  };

  for (let step = 0; step < 7; step += 1) {
    let provider: string;
    let model: string;
    let response: Response;
    let payload: any;
    try {
      ({ provider, model, response, payload } = await callLLM({
        db,
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: 400,
        temperature: 0.3,
        parallel_tool_calls: false,
      }));
    } catch (error) {
      console.error("rio callLLM", error instanceof Error ? error.message : error);
      return softFail(error instanceof Error ? error.message : "llm failed");
    }
    lastProvider = provider;
    lastModel = model;
    if (!response.ok) {
      const msg = llmFailureMessage(provider, response, payload);
      return softFail(msg);
    }
    const choice = payload?.choices?.[0]?.message ?? {};
    const toolCalls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
    if (toolCalls.length === 0) {
      const fallback =
        (typeof choice.content === "string" && choice.content.trim()) ||
        "What are you craving? Name a dish or cuisine and I will search nearby kitchens.";

      if (onToken) {
        await onProgress?.("Writing a reply…");
        try {
          const streamed = await streamLLM({
            db,
            messages,
            max_tokens: 700,
            temperature: 0.3,
            onToken: (token) => {
              void onToken(token);
            },
          });
          if (streamed.text.trim()) {
            lastProvider = streamed.provider;
            lastModel = streamed.model;
            return finish(streamed.text.trim());
          }
        } catch (error) {
          console.error("rio streamLLM", error instanceof Error ? error.message : error);
        }
        await emitTokenChunks(fallback, onToken);
      }

      return finish(fallback);
    }

    messages.push({
      role: "assistant",
      content: typeof choice.content === "string" ? choice.content : null,
      tool_calls: toolCalls,
    });
    for (const call of toolCalls) {
      const name = String(call.function?.name ?? "");
      toolsUsed.push(name);
      await onProgress?.(progressForTool(name));
      const rawArgs = toolArgs(call.function?.arguments);
      let outcome: ToolOutcome;

      if (!allow.has(name)) {
        outcome = {
          data: {
            error: "TOOL_NOT_ALLOWED",
            message: `Tool ${name} is not available for the ${route.agent} specialist.`,
            instruction: "Stay within your specialty tools, or ask a clarifying question.",
          },
          cards: [],
          conflict: null,
        };
      } else if (
        name === "cart" &&
        rawArgs.op === "add" &&
        lastToolErrorCode === "CART_OTHER_RESTAURANT"
      ) {
        outcome = {
          data: {
            error: "CART_OTHER_RESTAURANT",
            seller_choice: "two_orders",
            instruction:
              "Already blocked this turn. Do NOT cart add again. Explain two-order path or Clear & switch.",
          },
          cards: [],
          conflict: conflict,
        };
      } else {
        const validated = validateToolArgs(name, rawArgs);
        if (!validated.ok) {
          outcome = {
            data: {
              error: validated.error,
              message: validated.message,
              instruction: validated.instruction,
            },
            cards: [],
            conflict: null,
          };
        } else {
          try {
            outcome = await runTool(
              db,
              userId,
              deliveryAddress,
              deliveryAddressId,
              deliveryLat,
              deliveryLng,
              notes,
              name,
              validated.args,
            );
          } catch (error) {
            const detail = error instanceof Error ? error.message : "tool failed";
            outcome = {
              data: {
                error: "TOOL_FAILED",
                message: "Could not finish that step.",
                instruction:
                  "Apologize briefly. Suggest one next step. Never dump codes.",
                detail: redactPii(detail).slice(0, 120),
              },
              cards: [],
              conflict: null,
            };
          }
        }
      }

      cards = [...cards, ...outcome.cards];
      if (outcome.conflict) conflict = outcome.conflict;
      const errCode =
        typeof outcome.data.error === "string" ? String(outcome.data.error) : null;
      if (errCode) lastToolErrorCode = errCode;

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(redactPiiDeep(outcome.data)),
      });

      if (outcome.conflict) {
        const seller =
          "Your cart is from one kitchen already. One kitchen per order — checkout this cart then order the other kitchen, or Clear & switch. Do not retry cart add.";
        if (onToken) {
          await onProgress?.("Writing a reply…");
          try {
            const streamed = await streamLLM({
              db,
              messages: [
                ...messages,
                {
                  role: "system",
                  content:
                    "Cart conflict: stop tools. Explain the two-order seller choice in two short sentences. Cards/conflict UI will show Keep / Clear.",
                },
              ],
              max_tokens: 300,
              temperature: 0.3,
              onToken: (token) => {
                void onToken(token);
              },
            });
            if (streamed.text.trim()) {
              lastProvider = streamed.provider;
              lastModel = streamed.model;
              return finish(streamed.text.trim());
            }
          } catch (error) {
            console.error("rio streamLLM conflict", error instanceof Error ? error.message : error);
          }
          await emitTokenChunks(seller, onToken);
        }
        return finish(seller);
      }
    }
  }

  turnError = "tool_loop_exhausted";
  return finish("I got tangled. Ask me for one step, like a craving or your cart.");
}

export async function executeTurn(params: {
  requestId: string;
  db: any;
  userId: string;
  lastUser: string;
  context: string;
  snapshot: unknown;
  route: RouteResult;
  messages: ChatMessage[];
  llmHistory: ChatMessage[];
  deliveryAddress: string | null;
  deliveryAddressId: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  notes: string | null;
  onToken?: (token: string) => void | Promise<void>;
  onProgress?: (text: string) => void | Promise<void>;
}): Promise<{ outcome: RioTurnReply; chunked?: boolean }> {
  const {
    requestId,
    db,
    userId,
    lastUser,
    context,
    snapshot,
    route,
    messages,
    llmHistory,
    deliveryAddress,
    deliveryAddressId,
    deliveryLat,
    deliveryLng,
    notes,
    onToken,
    onProgress,
  } = params;

  if (route.agent === "clarify" || !isSpecialist(route.agent)) {
    const outcome = await runClarify(db, userId, route, messages, onToken);
    return { outcome };
  }

  const specialist = SPECIALISTS[route.agent];
  try {
    const fast = await tryFollowUpOrder(
      db,
      userId,
      lastUser,
      context,
      deliveryAddress,
      deliveryAddressId,
      deliveryLat,
      deliveryLng,
      notes,
    );
    if (fast) return { outcome: fast, chunked: true };
  } catch (error) {
    console.error(`rio [${requestId}] followup`, error instanceof Error ? error.message : error);
  }

  const outcome = await runChat(
    db,
    userId,
    deliveryAddress,
    deliveryAddressId,
    deliveryLat,
    deliveryLng,
    notes,
    buildSpecialistSystem(specialist, context, snapshot, route),
    llmHistory,
    toolsForNames(specialist.toolNames),
    specialist.toolNames,
    route,
    onToken,
    onProgress,
  );
  return { outcome };
}

async function runTool(
  db: any,
  userId: string,
  deliveryAddress: string | null,
  deliveryAddressId: string | null,
  deliveryLat: number | null,
  deliveryLng: number | null,
  notes: string | null,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolOutcome> {
  const args = input && typeof input === "object" ? input : {};
  switch (name) {
    case "browse_themes":
      return browseThemes(db, {
        ...args,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
      });
    case "find_offers":
    case "find_food":
      return findOffers(db, {
        ...args,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
      });
    case "verify_dish":
      return verifyDish(db, {
        ...args,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
      });
    case "get_menu":
      return getMenu(db, args);
    case "cart": {
      const op = typeof args.op === "string" ? args.op : "";
      if (op === "view") return viewCart(db);
      if (op === "add") {
        return isUuid(args.menu_item_id)
          ? addToCart(db, userId, args.menu_item_id, deliveryLat, deliveryLng)
          : { data: { error: "A menu item id is required." }, cards: [], conflict: null };
      }
      if (op === "set_qty") return updateCartQuantity(db, args);
      return { data: { error: "cart op must be view, add, or set_qty." }, cards: [], conflict: null };
    }
    case "checkout":
      return requestCheckout(db, deliveryAddress, deliveryLat, deliveryLng);
    case "place_order":
      return placeCustomerOrder(
        db,
        deliveryAddress,
        deliveryAddressId,
        deliveryLat,
        deliveryLng,
        notes,
        null,
      );
    case "order_status":
      return isUuid(args.order_id) ? checkDeliveryStatus(db, args) : trackOrder(db, args);
    case "estimate_eta":
      return estimateEta(db, userId, args);
    case "report_issue":
      return escalateComplaint(db, userId, args);
    case "reorder_last":
      return reorderLast(db, userId, deliveryLat, deliveryLng);
    case "save_prefs":
      return savePrefs(db, args);
    default:
      return {
        data: {
          error: "Unknown tool.",
          instruction: "Use only the tools listed for your specialty.",
        },
        cards: [],
        conflict: null,
      };
  }
}

async function savePrefs(db: any, args: Record<string, unknown>): Promise<ToolOutcome> {
  const patch: Record<string, unknown> = {};
  if (typeof args.diet === "string" && args.diet.trim()) patch.diet = args.diet.trim();
  if (typeof args.spice === "string" && args.spice.trim()) patch.spice = args.spice.trim();
  if (typeof args.budget_max === "number" && Number.isFinite(args.budget_max)) {
    patch.budget_max = args.budget_max;
  } else if (typeof args.budget_max === "string" && args.budget_max.trim()) {
    const n = Number(args.budget_max);
    if (Number.isFinite(n)) patch.budget_max = n;
  }
  if (Array.isArray(args.cuisines_like)) {
    patch.cuisines_like = args.cuisines_like.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
  }
  if (Array.isArray(args.avoid)) {
    patch.avoid = args.avoid.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
  }
  if (typeof args.notes === "string" && args.notes.trim()) {
    patch.notes = args.notes.trim().slice(0, 240);
  }
  if (Object.keys(patch).length === 0) {
    return { data: { error: "No preferences to save." }, cards: [], conflict: null };
  }
  const { data, error } = await db.rpc("rio_update_memory", { p_patch: patch });
  if (error) {
    return {
      data: { error: error.message || "Could not save preferences." },
      cards: [],
      conflict: null,
    };
  }
  return {
    data: {
      saved: true,
      memory: data,
      instruction: "Preferences saved. Acknowledge briefly, then continue helping.",
    },
    cards: [],
    conflict: null,
  };
}
