import { createClient } from "jsr:@supabase/supabase-js@2";
import { secretsMatch } from "../_shared/webhookAuth.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

type OrderRecord = {
  id: string;
  customer_id: string;
  status: string;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE";
  table?: string;
  schema?: string;
  record: OrderRecord;
};

type SmsEvent =
  | "sms_placed"
  | "sms_ready"
  | "sms_out_for_delivery"
  | "sms_delivered";

const STATUS_TO_EVENT: Record<string, SmsEvent> = {
  placed: "sms_placed",
  ready: "sms_ready",
  out_for_delivery: "sms_out_for_delivery",
  delivered: "sms_delivered",
};

const STATUS_LABEL: Record<string, string> = {
  placed: "received",
  ready: "ready for pickup",
  out_for_delivery: "out for delivery",
  delivered: "delivered",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function orderCode(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 6).toUpperCase();
}

/** Free-form body for upgraded Messaging accounts. */
function smsBody(status: string, orderId: string): string {
  const code = orderCode(orderId);
  switch (status) {
    case "placed":
      return `QuickBite: order #${code} received. We'll update you as it cooks.`;
    case "ready":
      return `QuickBite: order #${code} is ready. A rider will pick it up soon.`;
    case "out_for_delivery":
      return `QuickBite: order #${code} is on the way.`;
    case "delivered":
      return `QuickBite: order #${code} delivered. Enjoy your meal!`;
    default:
      return `QuickBite: order #${code} status: ${status}.`;
  }
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+") && cleaned.length >= 10) return cleaned;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return cleaned.startsWith("+") ? cleaned : null;
}

async function claimDispatch(
  admin: ReturnType<typeof createClient>,
  orderId: string,
  event: SmsEvent,
): Promise<"claimed" | "already_dispatched" | "error"> {
  const { error } = await admin.from("notification_dispatch_log").insert({
    order_id: orderId,
    event,
  });
  if (!error) return "claimed";
  const code = (error as { code?: string }).code;
  const message = String((error as { message?: string }).message ?? "");
  if (code === "23505" || /duplicate key|unique constraint/i.test(message)) {
    return "already_dispatched";
  }
  console.error("send-order-sms dispatch claim failed", error);
  return "error";
}

async function twilioFormPost(url: string, sid: string, token: string, fields: Record<string, string>) {
  const auth = btoa(`${sid}:${token}`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields).toString(),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

/**
 * Outbound SMS strategy (Twilio free trial constraints):
 * 1) Messages + ContentSid when TWILIO_CONTENT_SID is set (upgraded / template ready)
 * 2) Verify SMS when TWILIO_VERIFY_SERVICE_SID is set (works on new trials)
 * 3) Messages + Body (upgraded accounts only — trial returns 572006)
 */
async function sendTwilioSms(to: string, status: string, orderId: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  const contentSid = Deno.env.get("TWILIO_CONTENT_SID")?.trim();
  const verifySid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")?.trim();
  if (!sid || !token) {
    return { ok: false as const, reason: "twilio_not_configured" };
  }

  if (contentSid) {
    if (!from) return { ok: false as const, reason: "twilio_not_configured" };
    const result = await twilioFormPost(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      sid,
      token,
      {
        To: to,
        From: from,
        ContentSid: contentSid,
        ContentVariables: JSON.stringify({
          "1": `#${orderCode(orderId)}`,
          "2": STATUS_LABEL[status] ?? status,
        }),
      },
    );
    if (!result.ok) {
      console.error("send-order-sms content_error", result.status, result.text.slice(0, 400));
      return { ok: false as const, reason: "twilio_send_failed", status: result.status };
    }
    return { ok: true as const, channel: "content" as const };
  }

  if (verifySid) {
    // New Twilio Messaging trials block custom Body (572006) and Content API.
    // Verify SMS still works on free trial (OTP-style message appears in Twilio logs).
    const result = await twilioFormPost(
      `https://verify.twilio.com/v2/Services/${verifySid}/Verifications`,
      sid,
      token,
      {
        To: to,
        Channel: "sms",
      },
    );
    if (!result.ok) {
      console.error("send-order-sms verify_error", result.status, result.text.slice(0, 400));
      return { ok: false as const, reason: "twilio_verify_failed", status: result.status };
    }
    console.log(
      `send-order-sms verify_sent order=${orderCode(orderId)} status=${status}`,
    );
    return { ok: true as const, channel: "verify" as const };
  }

  if (!from) return { ok: false as const, reason: "twilio_not_configured" };
  const result = await twilioFormPost(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    sid,
    token,
    { To: to, From: from, Body: smsBody(status, orderId) },
  );
  if (!result.ok) {
    console.error("send-order-sms body_error", result.status, result.text.slice(0, 400));
    let reason = "twilio_send_failed";
    if (/572006|predefined SMS templates|ContentSid/i.test(result.text)) {
      reason = "twilio_template_required";
    }
    return { ok: false as const, reason, status: result.status };
  }
  return { ok: true as const, channel: "body" as const };
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error(`send-order-sms [${requestId}] missing_server_config`);
    return json({ error: "server_not_configured" }, 500);
  }
  if (!(await secretsMatch(req.headers.get("x-webhook-secret"), webhookSecret))) {
    return json({ error: "unauthorized" }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (
    !["INSERT", "UPDATE"].includes(payload.type) ||
    (payload.table && payload.table !== "orders") ||
    (payload.schema && payload.schema !== "public") ||
    !payload.record?.id
  ) {
    return json({ error: "invalid_webhook_payload" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: dbOrder, error: orderError } = await admin
    .from("orders")
    .select("id, customer_id, status")
    .eq("id", payload.record.id)
    .maybeSingle();
  if (orderError) {
    console.error(`send-order-sms [${requestId}] order_lookup_failed`);
    return json({ error: "order_lookup_failed" }, 500);
  }
  if (!dbOrder) return json({ error: "order_not_found" }, 404);

  const order = dbOrder as OrderRecord;
  const event = STATUS_TO_EVENT[order.status];
  if (!event) {
    return json({
      ok: true,
      ignored: true,
      reason: "status_not_sms",
      status: order.status,
    });
  }

  const claim = await claimDispatch(admin, order.id, event);
  if (claim === "error") return json({ error: "dispatch_claim_failed" }, 500);
  if (claim === "already_dispatched") {
    return json({
      ok: true,
      ignored: true,
      reason: "already_dispatched",
      idempotencyKey: `${order.id}:${event}`,
    });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", order.customer_id)
    .maybeSingle();
  if (profileError) {
    console.error(`send-order-sms [${requestId}] profile_lookup_failed`);
    return json({ error: "profile_lookup_failed" }, 500);
  }

  const to = normalizePhone(profile?.phone as string | null);
  if (!to) {
    return json({
      ok: true,
      ignored: true,
      reason: "no_customer_phone",
      idempotencyKey: `${order.id}:${event}`,
    });
  }

  const sent = await sendTwilioSms(to, order.status, order.id);
  if (!sent.ok) {
    return json({
      ok: true,
      sent: false,
      reason: sent.reason,
      idempotencyKey: `${order.id}:${event}`,
    });
  }

  return json({
    ok: true,
    sent: true,
    channel: sent.channel,
    idempotencyKey: `${order.id}:${event}`,
  });
});
