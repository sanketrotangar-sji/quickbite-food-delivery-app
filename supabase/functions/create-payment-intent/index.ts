import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function formBody(fields: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    params.set(key, value);
  }
  return params.toString();
}

/** Convert rupee total to Stripe INR smallest unit (paise). */
function toPaise(totalAmount: number): number {
  return Math.max(1, Math.round(Number(totalAmount) * 100));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const appScheme = (Deno.env.get("STRIPE_APP_REDIRECT_SCHEME") ?? "quickbite").replace(/:\/\/*$/, "");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "server_not_configured" }, 500);
  }
  if (!stripeSecret) {
    return json({ error: "stripe_not_configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "unauthorized" }, 401);

  let orderId = "";
  let clientSuccessUrl = "";
  let clientCancelUrl = "";
  try {
    const body = await req.json() as {
      orderId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };
    orderId = String(body.orderId ?? "").trim();
    clientSuccessUrl = String(body.successUrl ?? "").trim();
    clientCancelUrl = String(body.cancelUrl ?? "").trim();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!orderId) return json({ error: "order_id_required" }, 400);

  function isAllowedRedirect(url: string) {
    // App deep links (production scheme or Expo Go exp://) — not arbitrary https phishing.
    return (
      url.startsWith(`${appScheme}://`) ||
      url.startsWith("exp://") ||
      url.startsWith("exps://") ||
      (Deno.env.get("STRIPE_ALLOW_HTTPS_REDIRECT") === "1" && url.startsWith("https://"))
    );
  }

  const envSuccess = Deno.env.get("STRIPE_CHECKOUT_SUCCESS_URL")?.split("{ORDER_ID}").join(orderId);
  const envCancel = Deno.env.get("STRIPE_CHECKOUT_CANCEL_URL")?.split("{ORDER_ID}").join(orderId);
  const successUrl = isAllowedRedirect(clientSuccessUrl)
    ? clientSuccessUrl
    : (envSuccess ??
      `${appScheme}://orders/${orderId}?paid=1&session_id={CHECKOUT_SESSION_ID}`);
  const cancelUrl = isAllowedRedirect(clientCancelUrl)
    ? clientCancelUrl
    : (envCancel ?? `${appScheme}://orders/${orderId}?paid=0`);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id, customer_id, status, total_amount, payment_status, stripe_payment_intent_id, stripe_checkout_session_id",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) return json({ error: "order_lookup_failed" }, 500);
  if (!order) return json({ error: "order_not_found" }, 404);
  if (order.customer_id !== user.id) return json({ error: "forbidden" }, 403);
  if (order.status === "cancelled") {
    return json({ error: "order_cancelled" }, 400);
  }
  if (order.payment_status === "paid") {
    return json({ error: "already_paid", paymentStatus: "paid" }, 409);
  }
  if (order.payment_status === "refunded") {
    return json({ error: "already_refunded" }, 409);
  }

  const amountPaise = toPaise(Number(order.total_amount));
  const code = String(order.id).replace(/-/g, "").slice(0, 6).toUpperCase();

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: order.id,
      "metadata[order_id]": order.id,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "inr",
      "line_items[0][price_data][unit_amount]": String(amountPaise),
      "line_items[0][price_data][product_data][name]": `QuickBite order #${code}`,
      "payment_intent_data[metadata][order_id]": order.id,
      "expand[]": "payment_intent",
    }),
  });

  const stripeJson = await stripeRes.json() as {
    id?: string;
    url?: string;
    payment_intent?: string | { id?: string };
    error?: { message?: string };
  };

  if (!stripeRes.ok || !stripeJson.id || !stripeJson.url) {
    console.error("create-payment-intent stripe_error", stripeJson);
    return json({
      error: "stripe_session_failed",
      detail: stripeJson.error?.message ?? "checkout_session_failed",
    }, 502);
  }

  const paymentIntentId =
    typeof stripeJson.payment_intent === "string"
      ? stripeJson.payment_intent
      : stripeJson.payment_intent?.id ?? null;

  const { error: updateError } = await admin
    .from("orders")
    .update({
      payment_method: "card",
      stripe_checkout_session_id: stripeJson.id,
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
    })
    .eq("id", order.id)
    .eq("customer_id", user.id);

  if (updateError) {
    console.error("create-payment-intent order_update_failed", updateError);
    return json({ error: "order_update_failed" }, 500);
  }

  return json({
    ok: true,
    url: stripeJson.url,
    checkoutSessionId: stripeJson.id,
    paymentIntentId,
    amountPaise,
    currency: "inr",
  });
});
