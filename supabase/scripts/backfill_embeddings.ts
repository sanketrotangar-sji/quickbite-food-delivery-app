/**
 * Deno twin of scripts/backfill-embeddings.mjs — prefer the Node script for full sources.
 *
 *   deno run --allow-net --allow-env --allow-read supabase/scripts/backfill_embeddings.ts --source menu_items
 *
 * Supported: menu_items | ratings | orders | order_items | order_status_history | all
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";
import { EMBEDDING_DIMENSIONS, embedText } from "../functions/_shared/embeddings.ts";

type Source = "menu_items" | "ratings" | "orders" | "order_items" | "order_status_history";
const SOURCES: Source[] = ["menu_items", "ratings", "orders", "order_items", "order_status_history"];

function argValue(flag: string): string | null {
  const idx = Deno.args.indexOf(flag);
  if (idx < 0) return null;
  return Deno.args[idx + 1] ?? null;
}

function hashContent(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

async function loadExisting(db: ReturnType<typeof createClient>, source: Source) {
  const { data, error } = await db.from("embeddings").select("source_id, content_hash").eq("source_table", source);
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(String(row.source_id), row.content_hash as string);
  return map;
}

async function upsertRows(
  db: ReturnType<typeof createClient>,
  source: Source,
  rows: { id: string | number; text: string }[],
) {
  const existing = await loadExisting(db, source);
  let upserted = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.text) {
      skipped += 1;
      continue;
    }
    const contentHash = hashContent(row.text);
    const sid = String(row.id);
    if (existing.get(sid) === contentHash) {
      skipped += 1;
      continue;
    }
    const embedding = await embedText(row.text);
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Bad embedding length for ${source} ${sid}`);
    }
    const { error } = await db.from("embeddings").upsert(
      {
        source_table: source,
        source_id: sid,
        content_hash: contentHash,
        embedding: `[${embedding.join(",")}]`,
      },
      { onConflict: "source_table,source_id" },
    );
    if (error) throw new Error(error.message);
    upserted += 1;
  }
  return { upserted, skipped, total: rows.length };
}

async function backfill(db: ReturnType<typeof createClient>, source: Source) {
  if (source === "menu_items") {
    const { data, error } = await db.from("menu_items").select("id, name, category, description");
    if (error) throw new Error(error.message);
    return upsertRows(
      db,
      source,
      (data ?? []).map((r) => ({
        id: r.id as string,
        text: [r.name, r.category, r.description].filter(Boolean).join(" · ").trim(),
      })),
    );
  }
  if (source === "ratings") {
    const { data, error } = await db.from("ratings").select("id, comment, food_rating");
    if (error) throw new Error(error.message);
    return upsertRows(
      db,
      source,
      (data ?? []).map((r) => ({
        id: r.id as string,
        text: (r.comment as string | null)?.trim() || `Food rating ${r.food_rating}/5`,
      })),
    );
  }
  if (source === "orders") {
    const { data, error } = await db.from("orders").select("id, status, delivery_address, notes, restaurants(name)");
    if (error) throw new Error(error.message);
    return upsertRows(
      db,
      source,
      (data ?? []).map((r: any) => ({
        id: r.id,
        text: [
          `Order ${String(r.id).replace(/-/g, "").slice(0, 6)}`,
          r.status,
          r.restaurants?.name,
          r.delivery_address,
          r.notes,
        ]
          .filter(Boolean)
          .join(" · ")
          .trim(),
      })),
    );
  }
  if (source === "order_items") {
    const { data, error } = await db
      .from("order_items")
      .select("id, item_name, quantity, unit_price, orders(status, restaurants(name))");
    if (error) throw new Error(error.message);
    return upsertRows(
      db,
      source,
      (data ?? []).map((r: any) => ({
        id: r.id,
        text: [r.item_name, `x${r.quantity}`, `₹${r.unit_price}`, r.orders?.restaurants?.name, r.orders?.status]
          .filter(Boolean)
          .join(" · ")
          .trim(),
      })),
    );
  }
  const { data, error } = await db
    .from("order_status_history")
    .select("id, status, changed_at, orders(restaurants(name))");
  if (error) throw new Error(error.message);
  return upsertRows(
    db,
    source,
    (data ?? []).map((r: any) => ({
      id: r.id,
      text: [`Status ${r.status}`, r.orders?.restaurants?.name, String(r.changed_at ?? "").slice(0, 16)]
        .filter(Boolean)
        .join(" · ")
        .trim(),
    })),
  );
}

const sourceArg = argValue("--source") ?? "menu_items";
const sources: Source[] = sourceArg === "all" ? SOURCES : [sourceArg as Source];
for (const s of sources) {
  if (!SOURCES.includes(s)) {
    console.error(`Usage: --source ${SOURCES.join("|")}|all`);
    Deno.exit(1);
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  Deno.exit(1);
}
if (!Deno.env.get("OLLAMA_BASE_URL")?.trim()) {
  console.error("Set OLLAMA_BASE_URL (e.g. http://127.0.0.1:11434).");
  Deno.exit(1);
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const source of sources) {
  console.log(`Backfilling embeddings for ${source}…`);
  const result = await backfill(db, source);
  console.log(`Done. total=${result.total} upserted=${result.upserted} skipped=${result.skipped}`);
}
