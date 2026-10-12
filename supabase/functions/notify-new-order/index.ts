import { createClient } from "jsr:@supabase/supabase-js@2";
import { secretsMatch } from "../_shared/webhookAuth.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const JSON_HEADERS = { "Content-Type": "application/json" };

/** Demo FCM events only: kitchen accept (→ preparing) and delivery complete (→ delivered). */
type OrderRecord = {
  id: string;
  customer_id: string;
  restaurant_id: string;
  rider_id: string | null;
  status: string;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE";
  table?: string;
  schema?: string;
  record: OrderRecord;
  old_record?: OrderRecord | null;
};

type Recipient = {
  userId: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  details?: { error?: string };
};

type DispatchEvent = "preparing" | "delivered";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}


function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function expoHeaders() {
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  return accessToken
    ? { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` }
    : JSON_HEADERS;
}

async function claimDispatch(
  admin: ReturnType<typeof createClient>,
  orderId: string,
  event: DispatchEvent,
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
  console.error("notify-new-order dispatch claim failed", error);
  return "error";
}

async function sendExpoPush(
  admin: ReturnType<typeof createClient>,
  messages: Array<{
    to: string;
    title: string;
    body: string;
    data: Record<string, string>;
  }>,
) {
  const invalidTokens = new Set<string>();
  const receiptTokens = new Map<string, string>();

  for (const batch of chunks(messages, 100)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify(
        batch.map((message) => ({
          ...message,
          sound: "default",
          priority: "high",
          channelId: "orders",
        })),
      ),
    });
    if (!response.ok) {
      throw new Error(`Expo push request failed with status ${response.status}.`);
    }

    const result = (await response.json()) as { data?: ExpoTicket[] };
    (result.data ?? []).forEach((ticket, index) => {
      const token = batch[index]?.to;
      if (!token) return;
      if (ticket.details?.error === "DeviceNotRegistered") {
        invalidTokens.add(token);
      } else if (ticket.status === "ok" && ticket.id) {
        receiptTokens.set(ticket.id, token);
      }
    });
  }

  for (const receiptIds of chunks([...receiptTokens.keys()], 1000)) {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify({ ids: receiptIds }),
    });
    if (!response.ok) continue;
    const result = (await response.json()) as {
      data?: Record<string, { status: "ok" | "error"; details?: { error?: string } }>;
    };
    for (const [receiptId, receipt] of Object.entries(result.data ?? {})) {
      if (receipt.details?.error === "DeviceNotRegistered") {
        const token = receiptTokens.get(receiptId);
        if (token) invalidTokens.add(token);
      }
    }
  }

  if (invalidTokens.size > 0) {
    const { error } = await admin
      .from("push_device_tokens")
      .update({ enabled: false })
      .in("token", [...invalidTokens]);
    if (error) throw error;
  }

  return { sent: messages.length, disabled: invalidTokens.size };
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error(`notify-new-order [${requestId}] missing_server_config`);
    return json({ error: "server_not_configured" }, 500);
  }
  if (
    !(await secretsMatch(
      req.headers.get("x-webhook-secret"),
      webhookSecret,
    ))
  ) {
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

  // Trust DB row only — never fan-out using forged customer_id / rider_id from the payload.
  const { data: dbOrder, error: orderError } = await admin
    .from("orders")
    .select("id, customer_id, restaurant_id, rider_id, status")
    .eq("id", payload.record.id)
    .maybeSingle();
  if (orderError) {
    console.error(`notify-new-order [${requestId}] order_lookup_failed`);
    return json({ error: "order_lookup_failed" }, 500);
  }
  if (!dbOrder) {
    return json({ error: "order_not_found" }, 404);
  }

  const order = dbOrder as OrderRecord;

  // Event from current DB status only — ignore forged old_record transitions.
  let event: DispatchEvent | null = null;
  if (order.status === "preparing") event = "preparing";
  else if (order.status === "delivered") event = "delivered";

  if (!event) {
    return json({
      ok: true,
      ignored: true,
      reason: "status_not_notifiable",
      idempotencyKey: `${order.id}:${order.status}`,
    });
  }

  const claim = await claimDispatch(admin, order.id, event);
  if (claim === "error") {
    return json({ error: "dispatch_claim_failed" }, 500);
  }
  if (claim === "already_dispatched") {
    return json({
      ok: true,
      ignored: true,
      reason: "already_dispatched",
      idempotencyKey: `${order.id}:${event}`,
    });
  }

  const recipients: Recipient[] = [];

  if (event === "preparing") {
    recipients.push({
      userId: order.customer_id,
      title: "Order accepted",
      body: "Restaurant accepted your order. It's being prepared.",
      data: {
        audience: "customer",
        type: "order_accepted",
        orderId: order.id,
        status: order.status,
      },
    });

    const { data: riders, error } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "rider")
      .eq("is_online", true)
      .neq("id", order.customer_id);
    if (error) throw error;

    for (const rider of riders ?? []) {
      recipients.push({
        userId: rider.id,
        title: "New delivery available",
        body: "A nearby order is being prepared. Open the delivery pool to claim it.",
        data: {
          audience: "rider",
          type: "new_delivery",
          orderId: order.id,
        },
      });
    }
  }

  if (event === "delivered") {
    recipients.push({
      userId: order.customer_id,
      title: "Order delivered",
      body: "Your order was delivered. Enjoy your meal!",
      data: {
        audience: "customer",
        type: "order_delivered",
        orderId: order.id,
        status: order.status,
      },
    });
  }

  if (recipients.length === 0) return json({ ok: true, ignored: true });

  const { error: inboxError } = await admin.from("notifications").insert(
    recipients.map(({ userId, title, body }) => ({
      user_id: userId,
      title,
      body,
    })),
  );
  if (inboxError) throw inboxError;

  const recipientIds = [...new Set(recipients.map((item) => item.userId))];
  const { data: devices, error: tokenError } = await admin
    .from("push_device_tokens")
    .select("user_id, token")
    .in("user_id", recipientIds)
    .eq("enabled", true);
  if (tokenError) throw tokenError;

  const notificationsByUser = new Map<string, Recipient[]>();
  for (const recipient of recipients) {
    const current = notificationsByUser.get(recipient.userId) ?? [];
    current.push(recipient);
    notificationsByUser.set(recipient.userId, current);
  }

  const messages = (devices ?? []).flatMap((device) =>
    (notificationsByUser.get(device.user_id) ?? []).map((notification) => ({
      to: device.token,
      title: notification.title,
      body: notification.body,
      data: notification.data,
    }))
  );
  const push = await sendExpoPush(admin, messages);

  return json({
    ok: true,
    idempotencyKey: `${order.id}:${event}`,
    inboxRows: recipients.length,
    pushMessages: push.sent,
    disabledTokens: push.disabled,
  });
});
