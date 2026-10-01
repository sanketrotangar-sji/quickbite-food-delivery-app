import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
if (typeof globalThis.WebSocket === 'undefined') {
  // Node 20: supabase-js needs a WebSocket implementation
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  globalThis.WebSocket = require('ws') as typeof WebSocket;
}
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../..');

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile(join(ROOT, '.env'));
loadEnvFile(join(ROOT, 'apps/manager/.env'));

export const E2E_MARKER = 'E2E Kitchen Path';

export function requireE2EEnv() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const email = process.env.E2E_MANAGER_EMAIL || 'aniket@quickbite.test';
  const password = process.env.E2E_MANAGER_PASSWORD || 'sanket123';
  if (!url || !key) {
    throw new Error(
      'Kitchen E2E needs SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY for the order fixture.',
    );
  }
  if (!process.env.VITE_SUPABASE_URL && !process.env.SUPABASE_URL) {
    throw new Error('Kitchen E2E needs VITE_SUPABASE_URL so the dashboard can talk to Supabase.');
  }
  return { url, key, email, password };
}

function serviceClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Ensure a placed order exists for the manager's restaurant; returns marker text for UI lookup. */
export async function ensurePlacedOrderForManager(email: string) {
  const { url, key } = requireE2EEnv();
  const sb = serviceClient(url, key);

  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle();
  if (profileErr) throw new Error(profileErr.message);
  if (!profile) throw new Error(`No profile for ${email}`);

  const { data: membership, error: memErr } = await sb
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (memErr) throw new Error(memErr.message);

  let restaurantId = membership?.restaurant_id as string | undefined;
  if (!restaurantId) {
    const { data: owned } = await sb.from('restaurants').select('id').eq('owner_id', profile.id).limit(1).maybeSingle();
    restaurantId = owned?.id;
  }
  if (!restaurantId) {
    throw new Error(`${email} has no active restaurant membership or ownership`);
  }

  const { data: existing } = await sb
    .from('orders')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'placed')
    .ilike('delivery_address', `%${E2E_MARKER}%`)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return { orderId: existing.id as string, restaurantId, marker: E2E_MARKER };
  }

  const { data: customer, error: custErr } = await sb
    .from('profiles')
    .select('id')
    .eq('role', 'customer')
    .limit(1)
    .maybeSingle();
  if (custErr) throw new Error(custErr.message);
  if (!customer) throw new Error('Need at least one customer profile to insert an E2E order');

  const { data: menuItem } = await sb
    .from('menu_items')
    .select('id, name, price')
    .eq('restaurant_id', restaurantId)
    .eq('is_available', true)
    .limit(1)
    .maybeSingle();

  const itemName = menuItem?.name ?? 'E2E Test Dish';
  const unitPrice = Number(menuItem?.price ?? 199);
  const deliveryFee = 40;
  const total = unitPrice + deliveryFee;

  const { data: order, error: orderErr } = await sb
    .from('orders')
    .insert({
      customer_id: customer.id,
      restaurant_id: restaurantId,
      status: 'placed',
      total_amount: total,
      delivery_fee: deliveryFee,
      delivery_address: `${E2E_MARKER}, Mapusa, Goa`,
      notes: 'playwright kitchen happy-path',
    })
    .select('id')
    .single();
  if (orderErr) throw new Error(orderErr.message);

  const { error: itemErr } = await sb.from('order_items').insert({
    order_id: order.id,
    menu_item_id: menuItem?.id ?? null,
    item_name: itemName,
    quantity: 1,
    unit_price: unitPrice,
  });
  if (itemErr) throw new Error(itemErr.message);

  return { orderId: order.id as string, restaurantId, marker: E2E_MARKER };
}
