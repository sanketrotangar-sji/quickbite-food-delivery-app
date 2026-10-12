import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyStripeSignature } from "../_shared/stripeSignature.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

type StripeEvent = {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function orderIdFromObject(obj: Record<string, unknown> | undefined): string | null {
  if (!obj) return null;
  const meta = obj.metadata as Record<string, unknown> | undefined;
  const fromMeta = asString(meta?.order_id);
  if (fromMeta) return fromMeta;
  return asString(obj.client_reference_id);
}

async function writeAudit(
  admin: ReturnType<typeof createClient>,
  action: string,
  orderId: string | null,
  payload: Record<string, unknown>,
) {
  const { error } = await admin.from("admin_audit_log").insert({
    actor_id: null,
    action,
    order_id: orderId,
    payload,
  });
  if (error) console.error("stripe-webhook audit_failed", error);
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    console.error(`stripe-webhook [${requestId}] missing_server_config`);
    return json({ error: "server_not_configured" }, 500);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  const valid = await verifyStripeSignature(rawBody, signature, webhookSecret);
  if (!valid) {
    return json({ error: "invalid_signature" }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const obj = event.data?.object;
  const eventType = event.type;

  if (
    eventType === "payment_intent.succeeded" ||
    eventType === "checkout.session.completed"
  ) {
    const orderId = orderIdFromObject(obj);
    const paymentIntentId =
      eventType === "payment_intent.succeeded"
        ? asString(obj?.id)
        : asString(obj?.payment_intent) ??
          (typeof obj?.payment_intent === "object" && obj?.payment_intent
            ? asString((obj.payment_intent as { id?: string }).id)
            : null);
    const checkoutSessionId =
      eventType === "checkout.session.completed" ? asString(obj?.id) : null;

    if (!orderId && !paymentIntentId && !checkoutSessionId) {
      return json({ ok: true, ignored: true, reason: "no_order_ref" });
    }

    let query = admin.from("orders").select(
      "id, payment_status, stripe_payment_intent_id, stripe_checkout_session_id",
    );
    if (orderId) query = query.eq("id", orderId);
    else if (paymentIntentId) {
      query = query.eq("stripe_payment_intent_id", paymentIntentId);
    } else if (checkoutSessionId) {
      query = query.eq("stripe_checkout_session_id", checkoutSessionId);
    }

    const { data: order, error: lookupError } = await query.maybeSingle();
    if (lookupError) {
      console.error(`stripe-webhook [${requestId}] lookup_failed`, lookupError);
      return json({ error: "order_lookup_failed" }, 500);
    }
    if (!order) {
      return json({ ok: true, ignored: true, reason: "order_not_found" });
    }

    if (order.payment_status === "paid") {
      await writeAudit(admin, "stripe_payment_already_paid", order.id, {
        event_id: event.id,
        event_type: eventType,
      });
      return json({ ok: true, ignored: true, reason: "already_paid" });
    }

    const { error: updateError } = await admin
      .from("orders")
      .update({
        payment_method: "card",
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
        ...(checkoutSessionId
          ? { stripe_checkout_session_id: checkoutSessionId }
          : {}),
      })
      .eq("id", order.id);

    if (updateError) {
      console.error(`stripe-webhook [${requestId}] pay_update_failed`, updateError);
      return json({ error: "order_update_failed" }, 500);
    }

    await writeAudit(admin, "stripe_payment_succeeded", order.id, {
      event_id: event.id,
      event_type: eventType,
      payment_intent_id: paymentIntentId,
      checkout_session_id: checkoutSessionId,
    });

    return json({ ok: true, orderId: order.id, paymentStatus: "paid" });
  }

  if (eventType === "charge.refunded" || eventType === "payment_intent.canceled") {
    const paymentIntentId =
      eventType === "payment_intent.canceled"
        ? asString(obj?.id)
        : asString(obj?.payment_intent);
    const orderId = orderIdFromObject(obj);

    let query = admin.from("orders").select("id, payment_status, refunded_at");
    if (orderId) query = query.eq("id", orderId);
    else if (paymentIntentId) {
      query = query.eq("stripe_payment_intent_id", paymentIntentId);
    } else {
      return json({ ok: true, ignored: true, reason: "no_order_ref" });
    }

    const { data: order, error: lookupError } = await query.maybeSingle();
    if (lookupError) return json({ error: "order_lookup_failed" }, 500);
    if (!order) {
      return json({ ok: true, ignored: true, reason: "order_not_found" });
    }
    if (order.payment_status === "refunded" && order.refunded_at) {
      return json({ ok: true, ignored: true, reason: "already_refunded" });
    }

    const { error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: "refunded",
        refunded_at: new Date().toISOString(),
        refund_note: `Stripe ${eventType} (${event.id})`,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error(`stripe-webhook [${requestId}] refund_update_failed`, updateError);
      return json({ error: "order_update_failed" }, 500);
    }

    await writeAudit(admin, "stripe_charge_refunded", order.id, {
      event_id: event.id,
      event_type: eventType,
      payment_intent_id: paymentIntentId,
    });

    return json({ ok: true, orderId: order.id, paymentStatus: "refunded" });
  }

  return json({ ok: true, ignored: true, reason: "unhandled_event", type: eventType });
});
