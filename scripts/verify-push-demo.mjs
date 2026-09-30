#!/usr/bin/env node
/**
 * Smoke-check the FCM demo path (accept → preparing, delivered).
 *
 * Usage (from repo root, with .env containing WEBHOOK_SECRET + SUPABASE_SERVICE_ROLE_KEY):
 *   node scripts/verify-push-demo.mjs
 *   node scripts/verify-push-demo.mjs --order <uuid>
 *
 * Without --order: lists enabled push tokens and prints setup steps.
 * With --order: POSTs a synthetic UPDATE→preparing webhook for that order id
 * (does not change DB status — notify-new-order reloads the row from DB).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');

function loadEnv() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const PROJECT_REF = 'motqehtswgjbbvoazarh';
const BASE = `https://${PROJECT_REF}.supabase.co`;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.WEBHOOK_SECRET;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!serviceKey) fail('Missing SUPABASE_SERVICE_ROLE_KEY in .env');
if (!webhookSecret) fail('Missing WEBHOOK_SECRET in .env');

const args = process.argv.slice(2);
const orderFlag = args.indexOf('--order');
const orderId = orderFlag >= 0 ? args[orderFlag + 1] : null;

async function rest(path) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

console.log('=== Push tokens (enabled) ===');
const tokens = await rest(
  'push_device_tokens?select=user_id,platform,enabled,updated_at&enabled=eq.true&order=updated_at.desc&limit=20',
);
console.log(JSON.stringify(tokens, null, 2));
if (!Array.isArray(tokens) || tokens.length === 0) {
  console.warn(
    '\nNo enabled tokens. Sign in on the Android dev-client APK and allow notifications.',
  );
}

console.log('\n=== Online riders ===');
const riders = await rest(
  'profiles?select=id,full_name,is_online&role=eq.rider&is_online=eq.true&limit=20',
);
console.log(JSON.stringify(riders, null, 2));
if (!Array.isArray(riders) || riders.length === 0) {
  console.warn('\nNo online riders — accept alerts will not fan out to riders.');
}

if (!orderId) {
  console.log(`
=== Setup (run once if not done) ===
1. supabase login
2. supabase secrets set WEBHOOK_SECRET="$(grep ^WEBHOOK_SECRET= .env | cut -d= -f2-)"
3. supabase functions deploy notify-new-order
4. Dashboard → Database → Webhooks → create on public.orders (UPDATE)
   URL:  ${BASE}/functions/v1/notify-new-order
   Header: x-webhook-secret = value of WEBHOOK_SECRET in .env

=== Demo ===
1. Customer + rider APKs signed in; rider duty ON
2. Manager: placed → preparing  → customer + riders get OS push
3. Complete to delivered       → customer gets OS push

Re-run with a real order id to hit the function (uses DB status, not payload status):
  node scripts/verify-push-demo.mjs --order <order-uuid>
`);
  process.exit(0);
}

console.log(`\n=== Invoke notify-new-order for order ${orderId} ===`);
const order = await rest(
  `orders?select=id,customer_id,restaurant_id,rider_id,status&id=eq.${orderId}&limit=1`,
);
const row = Array.isArray(order) ? order[0] : null;
if (!row) fail(`Order not found: ${orderId}`);

const previous =
  row.status === 'preparing'
    ? 'placed'
    : row.status === 'delivered'
      ? 'out_for_delivery'
      : null;
if (!previous) {
  fail(
    `Order status is "${row.status}". Set it to preparing or delivered first, then re-run.`,
  );
}

const payload = {
  type: 'UPDATE',
  table: 'orders',
  schema: 'public',
  record: row,
  old_record: { ...row, status: previous },
};

const res = await fetch(`${BASE}/functions/v1/notify-new-order`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-webhook-secret': webhookSecret,
  },
  body: JSON.stringify(payload),
});
const body = await res.text();
console.log(`HTTP ${res.status}`);
console.log(body);
if (!res.ok) process.exit(1);
