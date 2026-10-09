#!/usr/bin/env node
/**
 * Validate generated synthetic catalog. Exit 1 on any failure.
 *
 * Usage: node scripts/datagen/validate.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'out');
const MIN_MENU = 20500;
const MIN_REST = 240;
const MAX_REST = 260;

const MEAT_RE = /\b(chicken|mutton|fish|prawn|egg|kingfish|pomfret|crab)\b/i;

const PRICE_BANDS = {
  beverage: [20, 250],
  dessert: [30, 300],
  side: [20, 250],
  snack: [30, 400],
  breakfast: [30, 350],
  main: [50, 600],
};

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function main() {
  const vocabPath = join(__dirname, 'tags_vocab.json');
  const menuPath = join(OUT_DIR, 'menu_items.json');
  const restPath = join(OUT_DIR, 'restaurants.json');
  const reportPath = join(OUT_DIR, 'generation_report.json');

  for (const p of [vocabPath, menuPath, restPath, reportPath]) {
    if (!existsSync(p)) fail(`missing ${p}`);
  }
  if (process.exitCode) process.exit(1);

  const vocab = JSON.parse(readFileSync(vocabPath, 'utf8'));
  const allowed = new Set(Object.values(vocab).flat());
  const restaurants = JSON.parse(readFileSync(restPath, 'utf8'));
  const menuItems = JSON.parse(readFileSync(menuPath, 'utf8'));
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));

  if (restaurants.length < MIN_REST || restaurants.length > MAX_REST) {
    fail(`restaurants count ${restaurants.length} not in [${MIN_REST},${MAX_REST}]`);
  }
  if (menuItems.length < MIN_MENU) {
    fail(`menu_items ${menuItems.length} < ${MIN_MENU}`);
  }

  const restIds = new Set(restaurants.map((r) => r.id));
  for (const r of restaurants) {
    if (!r.is_synthetic) fail(`restaurant ${r.id} is_synthetic=false`);
    if (!r.owner_id) fail(`restaurant ${r.id} missing owner_id`);
    if (!r.address || !String(r.address).trim()) fail(`restaurant ${r.id} empty address`);
    if (!r.name || !String(r.name).trim()) fail(`restaurant ${r.id} empty name`);
  }

  const seen = new Set();
  let vegMeat = 0;
  let badTag = 0;
  let badPrice = 0;

  for (const m of menuItems) {
    if (!m.is_synthetic) fail(`menu ${m.id} is_synthetic=false`);
    if (!restIds.has(m.restaurant_id)) fail(`menu ${m.id} orphan restaurant_id`);
    if (!m.name || !String(m.name).trim()) fail(`menu ${m.id} empty name`);

    const dedupeKey = `${m.restaurant_id}|${String(m.name).toLowerCase()}`;
    if (seen.has(dedupeKey)) fail(`duplicate (restaurant_id, name): ${m.name}`);
    seen.add(dedupeKey);

    if (m.is_veg === true) {
      const blob = `${m.name} ${m.description || ''}`;
      if (MEAT_RE.test(blob)) {
        vegMeat++;
        if (vegMeat <= 5) fail(`veg item has meat word: ${m.name}`);
      }
    }

    const tags = Array.isArray(m.tags) ? m.tags : [];
    for (const t of tags) {
      if (!allowed.has(t)) {
        badTag++;
        if (badTag <= 5) fail(`tag not in vocab: ${t} on ${m.name}`);
      }
    }

    const band = PRICE_BANDS[m.category] || [20, 600];
    const price = Number(m.price);
    if (!(price >= band[0] && price <= band[1])) {
      badPrice++;
      if (badPrice <= 5) fail(`unrealistic price ${price} for ${m.category} ${m.name}`);
    }
  }

  if (vegMeat > 0) fail(`${vegMeat} veg items contain meat words`);
  if (badTag > 0) fail(`${badTag} invalid tags`);
  if (badPrice > 0) fail(`${badPrice} unrealistic prices`);

  if (!report.min_target_met) fail('generation_report.min_target_met is false');

  // Must-have dish names present somewhere in expanded set (via menu)
  const must = [
    'Masala Dosa',
    'Chicken Biryani',
    'Filter Coffee',
    'Ukadiche Modak',
    'Kothimbir Vadi',
    'Margherita Pizza',
    'Kingfish Curry',
    'Mint Soda',
    'Lemon Juice',
    'Cold Coffee',
    'Cheese Burger',
    'Fries',
    'Pastry',
  ];
  const names = new Set(menuItems.map((m) => m.name));
  for (const n of must) {
    if (![...names].some((x) => x.toLowerCase() === n.toLowerCase())) {
      fail(`must-have dish missing from generated menu: ${n}`);
    }
  }

  if (process.exitCode) {
    console.error('Validation failed.');
    process.exit(1);
  }
  console.log(
    `OK: ${restaurants.length} restaurants, ${menuItems.length} menu_items, veg_ratio=${report.veg_ratio}, expanded=${report.expanded_dishes}`,
  );
}

main();
