import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { callLLM, llmFailureMessage, streamLLM } from "../_shared/llm.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { captureEdgeException } from "../_shared/sentry.ts";
import { dispatchAgent } from "./agents/dispatch.ts";
import { orderAgent } from "./agents/rioOrder.ts";
import {
  finalizeRoute,
  isSpecialist,
  routeIntent,
  routeTag,
} from "./agents/supervisor.ts";
import { CLARIFY_SYSTEM, supportAgent } from "./agents/support.ts";
import { toolsForNames, type ToolDef } from "./agents/toolDefs.ts";
import type { RouteResult, SpecialistDef } from "./agents/types.ts";
import {
  clarifyReply,
  redactPii,
  redactPiiDeep,
  validateToolArgs,
} from "./guardrails.ts";
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
  replaceCart,
  requestCheckout,
  trackOrder,
  updateCartQuantity,
  verifyDish,
  viewCart,
  type RioCard,
  type RioConflict,
  type ToolOutcome,
} from "./tools.ts";
import { appendThreadTurn, ensureThread, loadThreadHistory } from "./threads.ts";

const SPECIALISTS: Record<string, SpecialistDef> = {
  order: orderAgent,
  dispatch: dispatchAgent,
  support: supportAgent,
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const ADD_INTENT = /^add menu item ([0-9a-f-]{36})\b/i;

function snapshotHasActiveOrder(snapshot: unknown): boolean {
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

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "POST only." }, 405);
  }

  // The gateway already checked the JWT (verify_jwt = true). This client
  // forwards that same token, so every query runs as the customer and RLS applies.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey || !authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Sign in to talk to RIO." }, 401);
  }

  const db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.slice(7).trim();
  const { data: userData, error: userError } = await db.auth.getUser(token);
  const userId = userData.user?.id;
  if (userError || !userId) return json({ error: "Sign in to talk to RIO." }, 401);

  // Burst protection (per user + isolate). Override with RIO_RATE_LIMIT / RIO_RATE_WINDOW_MS secrets.
  const rateLimit = Number(Deno.env.get("RIO_RATE_LIMIT") ?? "40");
  const rateWindowMs = Number(Deno.env.get("RIO_RATE_WINDOW_MS") ?? "60000");
  const limited = checkRateLimit(`rio:${userId}`, {
    limit: Number.isFinite(rateLimit) && rateLimit > 0 ? Math.floor(rateLimit) : 40,
    windowMs: Number.isFinite(rateWindowMs) && rateWindowMs > 0 ? Math.floor(rateWindowMs) : 60_000,
  });
  if (!limited.ok) {
    return new Response(
      JSON.stringify({ error: "Too many RIO requests. Try again in a moment." }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(limited.retryAfterSec),
        },
      },
    );
  }

  let body: {
    messages?: ChatMessage[];
    threadId?: string | null;
    deliveryAddress?: string | null;
    deliveryAddressId?: string | null;
    deliveryLat?: number | null;
    deliveryLng?: number | null;
    notes?: string | null;
    action?: string;
    menuItemId?: string;
    cartHash?: string;
    context?: string;
    stream?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "RIO could not read that message." }, 400);
  }

  const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress : null;
  const deliveryAddressId = isUuid(body.deliveryAddressId) ? body.deliveryAddressId : null;
  const deliveryLat = typeof body.deliveryLat === "number" && body.deliveryLat >= -90 && body.deliveryLat <= 90
    ? body.deliveryLat
    : null;
  const deliveryLng = typeof body.deliveryLng === "number" && body.deliveryLng >= -180 && body.deliveryLng <= 180
    ? body.deliveryLng
    : null;
  const notes = typeof body.notes === "string" ? body.notes : null;
  const requestThreadId = isUuid(body.threadId) ? body.threadId : null;
  const actionLabel = typeof body.action === "string" ? body.action : body.stream ? "chat_stream" : "chat";

  async function persistTurn(userText: string, reply: { text: string; cards: RioCard[]; conflict: RioConflict | null }) {
    const tid = await ensureThread(db, userId, requestThreadId);
    if (!tid) return null;
    try {
      await appendThreadTurn(db, tid, userText, reply);
    } catch (error) {
      console.error(`rio [${requestId}] persist`, error instanceof Error ? error.message : error);
    }
    return tid;
  }

  try {
    if (body.action === "confirm_order") {
      console.log(`rio [${requestId}] action=${actionLabel}`);
      const expectedHash = typeof body.cartHash === "string" && body.cartHash.trim() ? body.cartHash.trim() : null;
      const outcome = await placeCustomerOrder(
        db,
        deliveryAddress,
        deliveryAddressId,
        deliveryLat,
        deliveryLng,
        notes,
        expectedHash,
      );
      const failed = typeof outcome.data.error === "string";
      const text = failed
        ? String(outcome.data.message ?? outcome.data.error)
        : "Placed. Here's where the order stands.";
      const reply = { text, cards: outcome.cards, conflict: null as RioConflict | null };
      const threadId = await persistTurn("Confirm order", reply);
      return json({ ...reply, threadId });
    }

    if (body.action === "replace_cart") {
      console.log(`rio [${requestId}] action=${actionLabel}`);
      if (!isUuid(body.menuItemId)) return json({ error: "That dish could not be added." }, 400);
      const outcome = await replaceCart(db, userId, body.menuItemId, deliveryLat, deliveryLng);
      const failed = typeof outcome.data.error === "string";
      const reply = {
        text: failed ? String(outcome.data.error) : "Cleared the old cart and added this dish.",
        cards: outcome.cards,
        conflict: outcome.conflict,
      };
      const threadId = await persistTurn("Clear cart and add this dish", reply);
      return json({ ...reply, threadId });
    }

    const clientMessages = sanitizeMessages(body.messages);
    if (clientMessages.length === 0 || clientMessages[clientMessages.length - 1]?.role !== "user") {
      return json({ error: "Tell RIO what you want." }, 400);
    }

    // Server-owned history: only trust the latest user text from the client.
    const lastUser = clientMessages[clientMessages.length - 1].content;
    const prior = await loadThreadHistory(db, userId, requestThreadId);
    const messages: ChatMessage[] = [...prior, { role: "user", content: lastUser }].slice(-8);

    const explicitAdd = ADD_INTENT.exec(lastUser);
    if (explicitAdd?.[1]) {
      const outcome = await addToCart(db, userId, explicitAdd[1], deliveryLat, deliveryLng);
      const reply = replyForAdd(outcome);
      const threadId = await persistTurn(lastUser, reply);
      return json({ ...reply, threadId });
    }

    const context = typeof body.context === "string" ? body.context.slice(0, 4000) : "";
    let snapshot: unknown = null;
    try {
      const { data, error: snapError } = await db.rpc("rio_snapshot", {
        ...(deliveryAddressId ? { p_delivery_address_id: deliveryAddressId } : {}),
      });
      if (snapError) {
        console.error(`rio [${requestId}] snapshot`, snapError.message);
      } else {
        snapshot = data;
      }
    } catch (error) {
      console.error(`rio [${requestId}] snapshot`, error instanceof Error ? error.message : error);
    }

    const hasActiveOrder = snapshotHasActiveOrder(snapshot);
    const route = finalizeRoute(routeIntent(lastUser, { hasActiveOrder }));
    console.log(
      `rio [${requestId}] action=${actionLabel} agent=${route.agent} conf=${route.confidence.toFixed(2)}`,
    );

    const wantStream = body.stream === true;
    const llmHistory = messages.map((m) =>
      m.role === "user" ? { ...m, content: redactPii(m.content) } : m
    );

    function buildSpecialistSystem(specialist: SpecialistDef): string {
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

    if (!wantStream) {
      if (route.agent === "clarify" || !isSpecialist(route.agent)) {
        const outcome = await runClarify(db, userId, route, messages);
        const threadId = await persistTurn(lastUser, outcome);
        return json({ ...outcome, threadId, agent: route.agent });
      }
      const specialist = SPECIALISTS[route.agent];
      let fast: { text: string; cards: RioCard[]; conflict: RioConflict | null } | null = null;
      try {
        fast = await tryFollowUpOrder(
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
      } catch (error) {
        console.error(
          `rio [${requestId}] followup`,
          error instanceof Error ? error.message : error,
        );
      }
      if (fast) {
        const threadId = await persistTurn(lastUser, fast);
        return json({ ...fast, threadId, agent: route.agent });
      }
      const outcome = await runChat(
        db,
        userId,
        deliveryAddress,
        deliveryAddressId,
        deliveryLat,
        deliveryLng,
        notes,
        buildSpecialistSystem(specialist),
        llmHistory,
        toolsForNames(specialist.toolNames),
        specialist.toolNames,
        route,
      );
      const threadId = await persistTurn(lastUser, outcome);
      return json({ ...outcome, threadId, agent: route.agent });
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();
    const writeLine = async (payload: unknown) => {
      await writer.write(encoder.encode(`${JSON.stringify(payload)}\n`));
    };

    void (async () => {
      try {
        if (route.agent === "clarify" || !isSpecialist(route.agent)) {
          const outcome = await runClarify(db, userId, route, messages, async (token) => {
            await writeLine({ type: "token", text: token });
          });
          const threadId = await persistTurn(lastUser, outcome);
          await writeLine({
            type: "done",
            text: outcome.text,
            cards: outcome.cards,
            conflict: outcome.conflict,
            threadId,
            agent: route.agent,
          });
          return;
        }

        const specialist = SPECIALISTS[route.agent];
        let fast: { text: string; cards: RioCard[]; conflict: RioConflict | null } | null = null;
        try {
          fast = await tryFollowUpOrder(
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
        } catch (error) {
          console.error(
            `rio [${requestId}] followup`,
            error instanceof Error ? error.message : error,
          );
        }
        if (fast) {
          const threadId = await persistTurn(lastUser, fast);
          const text = fast.text;
          if (text) {
            const chunk = 24;
            for (let i = 0; i < text.length; i += chunk) {
              await writeLine({ type: "token", text: text.slice(i, i + chunk) });
            }
          }
          await writeLine({
            type: "done",
            text: fast.text,
            cards: fast.cards,
            conflict: fast.conflict,
            threadId,
            agent: route.agent,
          });
          return;
        }
        const outcome = await runChat(
          db,
          userId,
          deliveryAddress,
          deliveryAddressId,
          deliveryLat,
          deliveryLng,
          notes,
          buildSpecialistSystem(specialist),
          llmHistory,
          toolsForNames(specialist.toolNames),
          specialist.toolNames,
          route,
          async (token) => {
            await writeLine({ type: "token", text: token });
          },
          async (text) => {
            await writeLine({ type: "progress", text });
          },
        );
        const threadId = await persistTurn(lastUser, outcome);
        await writeLine({
          type: "done",
          text: outcome.text,
          cards: outcome.cards,
          conflict: outcome.conflict,
          threadId,
          agent: route.agent,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "RIO could not answer just now.";
        console.error(`rio [${requestId}] stream`, message);
        const calm = message.startsWith("Sign in")
          ? message
          : "I hit a snag checking that. Want me to try again or pick another kitchen?";
        try {
          await writeLine({ type: "token", text: calm });
          await writeLine({ type: "done", text: calm, cards: [], conflict: null, threadId: null });
        } catch {
          await writeLine({ type: "error", error: calm });
        }
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(`rio [${requestId}]`, message);
    await captureEdgeException(error, { requestId, fn: "rio" });
    // Always return a chat-shaped 200 so the client can show recovery copy
    // instead of opaque "RIO HTTP 503" from the Edge gateway.
    const text = message.startsWith("RIO ")
      ? message
      : "I hit a snag just now. Try again in a moment — or tell me a dish to search.";
    return json({ text, cards: [], conflict: null, threadId: null, error: text }, 200);
  }
});

function replyForAdd(outcome: ToolOutcome) {
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

function sanitizeMessages(input: unknown): ChatMessage[] {
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

  // "that one" / "order it" → first suggestion
  return withDish[0]?.featuredDishId && isUuid(withDish[0].featuredDishId)
    ? withDish[0].featuredDishId
    : null;
}

/**
 * Deterministic follow-ups so "order that" / "proceed" don't get lost in LLM loops.
 */
async function tryFollowUpOrder(
  db: any,
  userId: string,
  lastUser: string,
  context: string,
  deliveryAddress: string | null,
  deliveryAddressId: string | null,
  deliveryLat: number | null,
  deliveryLng: number | null,
  notes: string | null,
): Promise<{ text: string; cards: RioCard[]; conflict: RioConflict | null } | null> {
  const text = lastUser.trim();
  if (!text) return null;

  const places = parseContextPlaces(context);
  const cart = await viewCart(db);
  const cartLines = Array.isArray((cart.data as { lines?: unknown })?.lines)
    ? ((cart.data as { lines: unknown[] }).lines)
    : [];
  const hasCart = cartLines.length > 0;

  // Place / proceed with an existing cart → place immediately.
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
      return {
        text: msg,
        cards: outcome.cards,
        conflict: null,
      };
    }
    return {
      text: "Placed. Here's where the order stands.",
      cards: outcome.cards,
      conflict: null,
    };
  }

  // Order a suggestion from recent cards.
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

    // Prefer placing when address is ready; otherwise show checkout confirm.
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
      // Fall through to checkout card if place failed (e.g. range).
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

async function runClarify(
  db: any,
  userId: string,
  route: RouteResult,
  history: ChatMessage[],
  onToken?: (token: string) => void | Promise<void>,
) {
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
        const chunk = 24;
        for (let i = 0; i < fallback.length; i += chunk) {
          await onToken(fallback.slice(i, i + chunk));
        }
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
      const chunk = 24;
      for (let i = 0; i < fallback.length; i += chunk) {
        await onToken(fallback.slice(i, i + chunk));
      }
    }
  }

  await logRioEvent(db, userId, toolsUsed, started, text, lastProvider, lastModel, null);
  return { text, cards: [] as RioCard[], conflict: null as RioConflict | null };
}

/**
 * Specialist tool rounds: non-stream callLLM.
 * When streaming: finalize with streamLLM (no tools); emit progress during tools.
 */
async function runChat(
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
) {
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
    if (onToken) {
      const chunk = 24;
      for (let i = 0; i < text.length; i += chunk) {
        await onToken(text.slice(i, i + chunk));
      }
    }
    return finish(text);
  };

  // Enough room for find_offers → get_menu → cart without dying mid-flow.
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
        const chunk = 24;
        for (let i = 0; i < fallback.length; i += chunk) {
          await onToken(fallback.slice(i, i + chunk));
        }
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
          const chunk = 24;
          for (let i = 0; i < seller.length; i += chunk) {
            await onToken(seller.slice(i, i + chunk));
          }
        }
        return finish(seller);
      }
    }
  }

  turnError = "tool_loop_exhausted";
  return finish("I got tangled. Ask me for one step, like a craving or your cart.");
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
    case "place_order": {
      // Verbal confirm — live cart hash accepted when expected hash is null.
      return placeCustomerOrder(
        db,
        deliveryAddress,
        deliveryAddressId,
        deliveryLat,
        deliveryLng,
        notes,
        null,
      );
    }
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
