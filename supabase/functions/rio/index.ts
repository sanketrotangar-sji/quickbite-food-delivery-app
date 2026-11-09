import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { requestLog } from "../_shared/requestLog.ts";
import { captureEdgeException } from "../_shared/sentry.ts";
import { finalizeRoute, routeIntent } from "./agents/supervisor.ts";
import { redactPii } from "./guardrails.ts";
import { json, streamRioResponse, type RioTurnReply } from "./stream.ts";
import { appendThreadTurn, ensureThread, loadThreadHistory } from "./threads.ts";
import {
  addToCart,
  isUuid,
  placeCustomerOrder,
  replaceCart,
  type RioConflict,
} from "./tools.ts";
import {
  ADD_INTENT,
  executeTurn,
  replyForAdd,
  sanitizeMessages,
  snapshotHasActiveOrder,
  type ChatMessage,
} from "./turn.ts";

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const started = Date.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    requestLog({ fn: "rio", requestId, ms: Date.now() - started, ok: false, error: "method_not_allowed" });
    return json({ error: "POST only." }, 405);
  }

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

  const rateLimit = Number(Deno.env.get("RIO_RATE_LIMIT") ?? "40");
  const rateWindowMs = Number(Deno.env.get("RIO_RATE_WINDOW_MS") ?? "60000");
  const limited = checkRateLimit(`rio:${userId}`, {
    limit: Number.isFinite(rateLimit) && rateLimit > 0 ? Math.floor(rateLimit) : 40,
    windowMs: Number.isFinite(rateWindowMs) && rateWindowMs > 0 ? Math.floor(rateWindowMs) : 60_000,
  });
  if (!limited.ok) {
    requestLog({ fn: "rio", requestId, ms: Date.now() - started, ok: false, error: "rate_limited" });
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

  async function persistTurn(userText: string, reply: RioTurnReply) {
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

    const llmHistory = messages.map((m) =>
      m.role === "user" ? { ...m, content: redactPii(m.content) } : m
    );

    const turnParams = {
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
    };

    if (!body.stream) {
      const { outcome } = await executeTurn(turnParams);
      const threadId = await persistTurn(lastUser, outcome);
      return json({ ...outcome, threadId, agent: route.agent });
    }

    requestLog({ fn: "rio", requestId, ms: Date.now() - started, ok: true, mode: "stream" });
    return streamRioResponse(requestId, route.agent, async ({ onToken, onProgress }) => {
      const { outcome, chunked } = await executeTurn({ ...turnParams, onToken, onProgress });
      const threadId = await persistTurn(lastUser, outcome);
      return { outcome, threadId, chunked };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(`rio [${requestId}]`, message);
    requestLog({ fn: "rio", requestId, ms: Date.now() - started, ok: false, error: message });
    await captureEdgeException(error, { requestId, fn: "rio" });
    const text = message.startsWith("RIO ")
      ? message
      : "I hit a snag just now. Try again in a moment — or tell me a dish to search.";
    return json({ text, cards: [], conflict: null, threadId: null, error: text }, 200);
  }
});
