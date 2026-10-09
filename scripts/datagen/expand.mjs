/**
 * Expand dish_catalog.json into ~600 natural dish variants via rule-based
 * protein swaps and style prefixes. No silly names.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROTEIN_WORDS = /\b(chicken|paneer|mushroom|mutton|prawn|fish|egg|pork|beef|crab|kingfish|pomfret|bombil)\b/i;

const PROTEIN_SWAPS = [
  { from: /\bchicken\b/i, to: 'Paneer', toKey: 'paneer', is_veg: true },
  { from: /\bchicken\b/i, to: 'Mushroom', toKey: 'mushroom', is_veg: true },
  { from: /\bpaneer\b/i, to: 'Chicken', toKey: 'chicken', is_veg: false },
  { from: /\bpaneer\b/i, to: 'Mushroom', toKey: 'mushroom', is_veg: true },
  { from: /\bmushroom\b/i, to: 'Paneer', toKey: 'paneer', is_veg: true },
  { from: /\bmushroom\b/i, to: 'Chicken', toKey: 'chicken', is_veg: false },
];

/** Styles applied only to savory mains/snacks (not drinks/desserts/breads). */
const STYLES = [
  { label: 'Schezwan', key: 'schezwan', tagsAdd: ['spicy'], cuisines: ['chinese', 'fast_food', 'italian'] },
  { label: 'Butter', key: 'butter', tagsAdd: ['creamy', 'indulgent'], cuisines: ['north_indian', 'fast_food', 'italian'] },
  { label: 'Loaded', key: 'loaded', tagsAdd: ['loaded', 'indulgent'], cuisines: ['fast_food', 'italian', 'chinese'] },
  { label: 'Classic', key: 'classic', tagsAdd: ['mild'], cuisines: null },
  { label: 'Dry', key: 'dry', tagsAdd: ['savory'], cuisines: ['chinese', 'maharashtrian', 'goan', 'north_indian'] },
  { label: 'Gravy', key: 'gravy', tagsAdd: ['savory'], cuisines: ['chinese', 'north_indian', 'goan', 'maharashtrian'] },
];

const NO_EXPAND_CATEGORIES = new Set(['beverage', 'dessert']);
const NO_EXPAND_KEYS = new Set([
  'filter_coffee',
  'filter_coffee_strong',
  'mint_soda',
  'lemon_juice',
  'cold_coffee',
  'fries',
  'pastry',
  'pois',
  'sannas',
  'pitta',
  'garlic_naan',
  'jeera_rice',
  'rasam',
  'sol_kadi',
  'solkadhi_mh',
  'kokum_sherbet',
  'coconut_water',
  'lassi_sweet',
  'lassi_salted',
  'buttermilk',
  'orange_juice',
  'sweet_lime',
  'jaljeera',
  'mango_smoothie',
  'milkshake_chocolate',
  'milkshake_strawberry',
  'ice_cream_scoop',
  'ukadiche_modak',
  'bebinca',
  'dodol',
  'shrikhand',
  'puraan_poli',
  'sheera',
  'tiramisu',
  'brownie',
  'pastry',
  'coleslaw',
]);

function slugKey(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function cloneDish(base, { canonical_key, name, is_veg, tags, price_min, price_max }) {
  return {
    ...base,
    canonical_key,
    name,
    is_veg,
    tags: [...new Set(tags)],
    price_min,
    price_max,
    descriptions: base.descriptions.map((d) =>
      d.replace(new RegExp(base.name, 'gi'), name).replace(/\b(chicken|paneer|mushroom)\b/gi, (m) => {
        if (/chicken/i.test(name) && /paneer|mushroom/i.test(m)) return name.match(/chicken/i)?.[0] || 'chicken';
        if (/paneer/i.test(name) && /chicken|mushroom/i.test(m)) return 'paneer';
        if (/mushroom/i.test(name) && /chicken|paneer/i.test(m)) return 'mushroom';
        return m;
      }),
    ),
    aliases: [],
    _expanded_from: base.canonical_key,
  };
}

function alreadyHasStyle(name, styleLabel) {
  return new RegExp(`\\b${styleLabel}\\b`, 'i').test(name);
}

function canApplyStyle(base, style) {
  if (NO_EXPAND_CATEGORIES.has(base.category)) return false;
  if (NO_EXPAND_KEYS.has(base.canonical_key)) return false;
  if (style.cuisines && !style.cuisines.includes(base.cuisine)) return false;
  if (alreadyHasStyle(base.name, style.label)) return false;
  // Dry/Gravy only when name doesn't already say dry/gravy
  if (style.key === 'dry' && /\b(dry|gravy|soup|rice|noodles|pizza|burger|wrap|thali|biryani|dosa|idli)\b/i.test(base.name))
    return false;
  if (style.key === 'gravy' && /\b(dry|gravy|soup|rice|noodles|pizza|burger|wrap|thali|biryani|dosa|idli|fry|fried)\b/i.test(base.name))
    return false;
  if (style.key === 'schezwan' && !['chinese', 'fast_food', 'italian'].includes(base.cuisine)) return false;
  if (style.key === 'butter' && /\bbutter\b/i.test(base.name)) return false;
  if (style.key === 'loaded' && /\bloaded\b/i.test(base.name)) return false;
  // Classic only for mains/snacks that aren't already "classic"
  if (style.key === 'classic' && !['main', 'snack', 'breakfast'].includes(base.category)) return false;
  return true;
}

function styleName(baseName, style) {
  if (style.key === 'dry' || style.key === 'gravy') {
    return `${baseName} (${style.label})`;
  }
  return `${style.label} ${baseName}`;
}

/**
 * @param {object[]} catalog
 * @returns {object[]}
 */
export function expandCatalog(catalog) {
  const byKey = new Map();
  const add = (dish) => {
    if (byKey.has(dish.canonical_key)) return;
    byKey.set(dish.canonical_key, dish);
  };

  for (const base of catalog) add({ ...base, tags: [...base.tags] });

  // Protein swaps
  for (const base of catalog) {
    if (NO_EXPAND_CATEGORIES.has(base.category)) continue;
    if (NO_EXPAND_KEYS.has(base.canonical_key)) continue;
    if (!PROTEIN_WORDS.test(base.name)) continue;
    // Don't swap seafood/mutton/pork/egg bases into paneer awkwardly for non-chicken/paneer/mushroom
    if (!/\b(chicken|paneer|mushroom)\b/i.test(base.name)) continue;

    for (const swap of PROTEIN_SWAPS) {
      if (!swap.from.test(base.name)) continue;
      const newName = base.name.replace(swap.from, swap.to);
      if (newName === base.name) continue;
      const key = slugKey(newName);
      if (byKey.has(key)) continue;
      // Skip silly: Chicken Dosa already covered via paneer_dosa etc.; allow natural ones
      if (/\b(dosa|idli|modak|poli|shrikhand|lassi|coffee|soda|juice|pastry|brownie|bebinca)\b/i.test(newName) && !swap.is_veg && /dosa|idli/i.test(newName) === false) {
        // allow chicken dosa? skip sweets
      }
      if (/\b(modak|poli|shrikhand|lassi|coffee|soda|juice|pastry|brownie|bebinca|dodol|sheera|tiramisu)\b/i.test(newName)) {
        continue;
      }

      const tags = base.tags.filter((t) => t !== 'seafood');
      if (!swap.is_veg) {
        // keep savory etc.
      } else {
        // remove nothing critical
      }

      const priceDelta = swap.is_veg === base.is_veg ? 0 : swap.is_veg ? -20 : 30;
      add(
        cloneDish(base, {
          canonical_key: key,
          name: newName,
          is_veg: swap.is_veg,
          tags,
          price_min: Math.max(30, base.price_min + priceDelta),
          price_max: Math.max(40, base.price_max + priceDelta),
        }),
      );
    }
  }

  // Style variants on original + protein-swapped
  const snapshot = [...byKey.values()];
  for (const base of snapshot) {
    for (const style of STYLES) {
      if (!canApplyStyle(base, style)) continue;
      const newName = styleName(base.name, style);
      const key = slugKey(newName.replace(/[()]/g, ' '));
      if (byKey.has(key)) continue;

      // Avoid Schezwan Filter Coffee etc. already blocked; also skip thali/biryani gravy noise lightly
      if (style.key === 'schezwan' && /\b(biryani|thali|paratha|naan|rasam|poha|idli)\b/i.test(base.name)) continue;

      const tags = [...new Set([...base.tags, ...style.tagsAdd])];
      const bump = style.key === 'loaded' || style.key === 'butter' ? 25 : style.key === 'schezwan' ? 15 : 10;
      add(
        cloneDish(base, {
          canonical_key: key,
          name: newName,
          is_veg: base.is_veg,
          tags,
          price_min: base.price_min + bump,
          price_max: base.price_max + bump,
        }),
      );
    }
  }

  return [...byKey.values()];
}

export function loadAndExpand() {
  const catalog = JSON.parse(readFileSync(join(__dirname, 'dish_catalog.json'), 'utf8'));
  return { base: catalog, expanded: expandCatalog(catalog) };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('expand.mjs')) {
  const { base, expanded } = loadAndExpand();
  console.log(JSON.stringify({ base: base.length, expanded: expanded.length }, null, 2));
}
