import { createClient } from "jsr:@supabase/supabase-js@2";

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

async function secretsMatch(provided: string | null, expected: string) {
  if (!provided) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return mismatch === 0;
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
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("Notification function is missing required server configuration.");
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
    console.error("notify-new-order order lookup failed", orderError);
    return json({ error: "order_lookup_failed" }, 500);
  }
  if (!dbOrder) {
    return json({ error: "order_not_found" }, 404);
  }

  const order = dbOrder as OrderRecord;
  const previousStatus = payload.old_record?.status ?? null;
  const enteredPreparing =
    payload.type === "UPDATE" &&
    order.status === "preparing" &&
    previousStatus !== "preparing";
  const enteredDelivered =
    payload.type === "UPDATE" &&
    order.status === "delivered" &&
    previousStatus !== "delivered";

  // Demo scope: only accept (preparing) and delivered fire pushes / inbox rows.
  if (!enteredPreparing && !enteredDelivered) {
    return json({
      ok: true,
      ignored: true,
      idempotencyKey: `${order.id}:${order.status}:${payload.type.toLowerCase()}`,
    });
  }

  const recipients: Recipient[] = [];

  if (enteredPreparing) {
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

  if (enteredDelivered) {
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
    idempotencyKey: `${order.id}:${order.status}:${enteredPreparing ? "preparing" : "delivered"}`,
    inboxRows: recipients.length,
    pushMessages: push.sent,
    disabledTokens: push.disabled,
  });
});
