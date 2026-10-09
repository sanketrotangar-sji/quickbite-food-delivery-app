#!/usr/bin/env node
/**
 * Place cloud kitchens into Margao / Verna test clusters (+ rest of Goa).
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage: node scripts/apply-goa-kitchen-geo.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(join(ROOT, '.env'));
loadEnvFile(join(ROOT, 'apps/manager/.env'));
loadEnvFile(join(ROOT, 'apps/client/.env'));

/** Match by exact restaurant name currently in cloud. */
const KITCHENS = [
  // ——— Margao cluster ———
  { name: 'Malvan Aangan', address: 'Grace Church Rd, Margao', lat: 15.2752, lng: 73.9614 },
  { name: 'Wok & Roll', address: 'Fatorda stadium road, Margao', lat: 15.2856, lng: 73.9548 },
  { name: "Fisherman's Local", address: 'Near Colva circle (Margao side)', lat: 15.2795, lng: 73.9589 },
  { name: "Martin's Corner", address: 'Near Municipal Garden, Margao', lat: 15.2728, lng: 73.9572 },
  { name: 'Susegado', address: 'Old Market lane, Margao', lat: 15.2812, lng: 73.9654 },
  { name: 'Infanteria', address: 'Abade Faria Rd, Margao', lat: 15.2764, lng: 73.9598 },
  { name: 'Jamies Restaurant', address: 'Isidorio Baptista Rd, Margao', lat: 15.2741, lng: 73.9625 },
  { name: 'Copperleaf', address: 'Near Grace Church, Margao', lat: 15.2778, lng: 73.9602 },

  // ——— Verna / Nagoa cluster ———
  { name: 'Café Laranja', address: 'NH66 service road, Verna', lat: 15.3482, lng: 73.9224 },
  { name: 'Green Bowl Co.', address: 'Nagoa–Verna junction', lat: 15.3604, lng: 73.9346 },
  { name: 'The Deccan Table', address: 'Airport Rd near Sancoale (Verna–Margao)', lat: 15.3256, lng: 73.9418 },
  { name: 'Burger Factory', address: 'Verna Industrial Estate Rd, Verna', lat: 15.3548, lng: 73.9282 },
  { name: 'Aura Cafe', address: 'Verna village market road', lat: 15.3512, lng: 73.9248 },
  { name: 'Bean Me Up', address: 'NH66 / Verna bypass', lat: 15.3576, lng: 73.9311 },
  { name: 'Botanico', address: 'Nagoa church road, Verna', lat: 15.3628, lng: 73.9274 },
  { name: 'Peep Kitchen', address: 'Verna Industrial Estate gate 2', lat: 15.3495, lng: 73.9358 },

  // ——— Across Goa (outside Near me from Margao + Verna) ———
  { name: 'Udupi Heritage', address: '18th June Rd, Panaji', lat: 15.4905, lng: 73.8272 },
  { name: 'Casa do Mar', address: 'Dona Paula jetty road', lat: 15.4572, lng: 73.8028 },
  { name: "Nonna's Oven", address: 'Municipal Market Rd, Mapusa', lat: 15.591, lng: 73.8095 },
  { name: 'Mum\'s Kitchen', address: 'DB Marg, Panaji', lat: 15.4975, lng: 73.8439 },
  { name: 'Ritz Classic', address: 'Wagle Vision, Panaji', lat: 15.4942, lng: 73.7983 },
  { name: 'The Black Sheep Bistro', address: 'Villa Braganza, Panaji', lat: 15.456, lng: 73.8755 },
  { name: 'Viva Panjim', address: '31st January Rd, Fontainhas', lat: 15.4982, lng: 73.8278 },
  { name: 'Joseph Bar', address: 'Gomes Pereira Rd, Fontainhas', lat: 15.4965, lng: 73.8261 },
  { name: 'Souza Lobo', address: 'Calangute Beach Rd', lat: 15.5439, lng: 73.7553 },
  { name: 'Thalassa', address: 'Vaddy, Siolim', lat: 15.5269, lng: 73.8765 },
  { name: 'Gunpowder', address: 'Assagao–Anjuna Rd', lat: 15.4833, lng: 73.8188 },
  { name: 'La Plage', address: 'Ashwem Beach, Mandrem', lat: 15.4875, lng: 73.8559 },
  { name: 'Fat Fish', address: 'Calangute–Arpora Rd, Arpora', lat: 15.5309, lng: 73.887 },
  { name: 'Spice Goa', address: 'NH-66, Karaswada, Mapusa', lat: 15.5282, lng: 73.8346 },
  { name: 'Anand Seafood Restaurant', address: 'Highway Junction, Anjuna', lat: 15.5192, lng: 73.8145 },
  { name: 'Antares Restaurant & Beach Club', address: 'Ozran Beach, Vagator', lat: 15.4849, lng: 73.8477 },
  { name: 'Bhatti Village', address: 'Bhatti Waddo, Nerul', lat: 15.4941, lng: 73.8212 },
  { name: 'Sakana', address: 'Chapora Rd, Anjuna', lat: 15.4406, lng: 73.8691 },
  { name: 'Vinayak Family Restaurant', address: 'Main Road, Anjuna', lat: 15.5077, lng: 73.868 },
];

const url =
  process.env.SUPABASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { transport: WebSocket },
});

let updated = 0;
const missing = [];
for (const kitchen of KITCHENS) {
  const { data, error } = await supabase
    .from('restaurants')
    .update({
      lat: kitchen.lat,
      lng: kitchen.lng,
      address: kitchen.address,
      updated_at: new Date().toISOString(),
    })
    .eq('name', kitchen.name)
    .select('id, name');
  if (error) {
    console.error(`Failed ${kitchen.name}:`, error.message);
    process.exit(1);
  }
  if (!data?.length) {
    missing.push(kitchen.name);
    continue;
  }
  updated += data.length;
  console.log(`OK ${kitchen.name}`);
}

const { count: nullCoords, error: countError } = await supabase
  .from('restaurants')
  .select('id', { count: 'exact', head: true })
  .or('lat.is.null,lng.is.null');
if (countError) {
  console.error('Verify failed:', countError.message);
  process.exit(1);
}

console.log(`Updated ${updated}. Missing: ${missing.length ? missing.join(', ') : 'none'}.`);
console.log(`Still missing lat/lng: ${nullCoords ?? 0}`);
