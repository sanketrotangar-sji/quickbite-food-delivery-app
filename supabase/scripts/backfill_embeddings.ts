/**
 * Batch-embed rows from a source table into public.embeddings.
 *
 * Always uses Ollama nomic-embed-text (768-d) — independent of chat provider.
 * Run after seed data exists:
 *
 *   OLLAMA_BASE_URL=http://127.0.0.1:11434 \
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   deno run --allow-net --allow-env supabase/scripts/backfill_embeddings.ts --source menu_items
 *
 * Supported --source: menu_items | ratings
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";
import {
  EMBEDDING_DIMENSIONS,
  embedText,
} from "../functions/_shared/embeddings.ts";

type Source = "menu_items" | "ratings";

function argValue(flag: string): string | null {
  const idx = Deno.args.indexOf(flag);
  if (idx < 0) return null;
  return Deno.args[idx + 1] ?? null;
}

function hashContent(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function menuText(row: {
  name: string;
  category: string | null;
  description: string | null;
}) {
  return [row.name, row.category, row.description].filter(Boolean).join(" · ").trim();
}

function ratingText(row: { comment: string | null; food_rating: number }) {
  const comment = row.comment?.trim();
  if (comment) return comment;
  return `Food rating ${row.food_rating}/5`;
}

async function loadExisting(
  db: ReturnType<typeof createClient>,
  source: Source,
) {
  const { data, error } = await db
    .from("embeddings")
    .select("source_id, content_hash")
    .eq("source_table", source);
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.source_id as string, row.content_hash as string);
  }
  return map;
}

async function backfillMenuItems(db: ReturnType<typeof createClient>) {
  const existing = await loadExisting(db, "menu_items");
  const { data, error } = await db
    .from("menu_items")
    .select("id, name, category, description");
  if (error) throw new Error(error.message);

  let upserted = 0;
  let skipped = 0;
  for (const row of data ?? []) {
    const text = menuText(row);
    if (!text) {
      skipped += 1;
      continue;
    }
    const contentHash = hashContent(text);
    if (existing.get(row.id) === contentHash) {
      skipped += 1;
      continue;
    }
    const embedding = await embedText(text);
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Bad embedding length for menu_items ${row.id}`);
    }
    const { error: upsertError } = await db.from("embeddings").upsert(
      {
        source_table: "menu_items",
        source_id: row.id,
        content_hash: contentHash,
        embedding: `[${embedding.join(",")}]`,
      },
      { onConflict: "source_table,source_id" },
    );
    if (upsertError) throw new Error(upsertError.message);
    upserted += 1;
    console.log(`menu_items ${row.id} upserted`);
  }
  return { upserted, skipped, total: data?.length ?? 0 };
}

async function backfillRatings(db: ReturnType<typeof createClient>) {
  const existing = await loadExisting(db, "ratings");
  const { data, error } = await db
    .from("ratings")
    .select("id, comment, food_rating");
  if (error) throw new Error(error.message);

  let upserted = 0;
  let skipped = 0;
  for (const row of data ?? []) {
    const text = ratingText(row);
    const contentHash = hashContent(text);
    if (existing.get(row.id) === contentHash) {
      skipped += 1;
      continue;
    }
    const embedding = await embedText(text);
    const { error: upsertError } = await db.from("embeddings").upsert(
      {
        source_table: "ratings",
        source_id: row.id,
        content_hash: contentHash,
        embedding: `[${embedding.join(",")}]`,
      },
      { onConflict: "source_table,source_id" },
    );
    if (upsertError) throw new Error(upsertError.message);
    upserted += 1;
    console.log(`ratings ${row.id} upserted`);
  }
  return { upserted, skipped, total: data?.length ?? 0 };
}

const source = (argValue("--source") ?? "menu_items") as Source;
if (source !== "menu_items" && source !== "ratings") {
  console.error("Usage: --source menu_items|ratings");
  Deno.exit(1);
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

console.log(`Backfilling embeddings for ${source}…`);
const result =
  source === "menu_items" ? await backfillMenuItems(db) : await backfillRatings(db);
console.log(
  `Done. total=${result.total} upserted=${result.upserted} skipped=${result.skipped}`,
);
