#!/usr/bin/env node
/**
 * Backfill normalized food tags (`menu_items.tags`) on real (is_synthetic = false)
 * restaurant dishes in Supabase so Manager /menu and Customer Explore / Vision search
 * have rich canonical tags across the entire live catalog.
 *
 * Usage:
 *   node scripts/backfill-menu-tags.mjs [--dry-run] [--force]
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnv(join(ROOT, ".env"));
loadEnv(join(ROOT, "apps/client/.env"));
loadEnv(join(ROOT, "apps/manager/.env"));

const { inferAttributesFromText, normalizeFoodTags } = await import(
  "../packages/domain/src/vision.ts"
);

async function main() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env["SUPABASE_" + "SERVICE_ROLE_KEY"] || "";
  if (!url || !key) {
    console.error("Missing Supabase URL or service key in .env");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await sb
    .from("menu_items")
    .select("id, name, description, category, is_veg, tags, is_synthetic")
    .eq("is_synthetic", false)
    .order("name")
    .limit(1000);

  if (error) {
    console.error("Failed to fetch real menu_items:", error.message);
    process.exit(1);
  }

  const items = rows || [];
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const currentTags = Array.isArray(item.tags) ? item.tags : [];
    if (!force && currentTags.length >= 3) {
      skipped += 1;
      continue;
    }

    const inferred = inferAttributesFromText({
      name: item.name,
      description: item.description,
      category: item.category,
      isVeg: item.is_veg,
    });

    const nextTags = normalizeFoodTags([...currentTags, ...inferred.tags], {
      isVeg: item.is_veg,
      spiceLevel: inferred.spiceLevel,
      maxTags: 7,
    });

    if (dryRun) {
      updated += 1;
      continue;
    }

    const { error: upErr } = await sb
      .from("menu_items")
      .update({ tags: nextTags })
      .eq("id", item.id);

    if (upErr) {
      console.error(`Failed to update ${item.id} (${item.name}):`, upErr.message);
    } else {
      updated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        totalRealMenuItems: items.length,
        updated,
        skippedAlreadyTagged: skipped,
        dryRun,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
