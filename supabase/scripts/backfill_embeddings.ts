/**
 * Deno twin of scripts/backfill-embeddings.mjs — prefer the Node script.
 *
 *   deno run --allow-net --allow-env --allow-read supabase/scripts/backfill_embeddings.ts --source all
 *
 * Flags: --source menu_items|ratings|all  --force  --limit N  --concurrency N
 * Menu: buildMenuItemText. Ratings: comments only.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../functions/_shared/embeddings.ts";
import { buildMenuItemText } from "../functions/_shared/ragText.mjs";

type Source = "menu_items" | "ratings";
const SOURCES: Source[] = ["menu_items", "ratings"];
const DEFAULT_CONCURRENCY = 2;
const BATCH_SIZE = 16;

function argValue(flag: string): string | null {
  const idx = Deno.args.indexOf(flag);
  if (idx < 0) return null;
  return Deno.args[idx + 1] ?? null;
}

function hasFlag(flag: string) {
  return Deno.args.includes(flag);
}

function hashContent(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function ollamaBase() {
  return (Deno.env.get("OLLAMA_BASE_URL")?.trim() || "http://127.0.0.1:11434").replace(/\/+$/, "");
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await fetch(`${ollamaBase()}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama embed failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const body = await response.json();
  let vectors: unknown[] | null = null;
  if (Array.isArray(body?.embeddings) && body.embeddings.length === texts.length) {
    vectors = body.embeddings;
  } else if (texts.length === 1 && Array.isArray(body?.embedding)) {
    vectors = [body.embedding];
  }
  if (!vectors || vectors.length !== texts.length) {
    throw new Error(`Expected ${texts.length} embeddings, got ${vectors?.length ?? 0}`);
  }
  return vectors.map((vector, i) => {
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS}-d vector at [${i}], got ${
          Array.isArray(vector) ? vector.length : "none"
        }`,
      );
    }
    return vector.map((n) => Number(n));
  });
}

async function loadExisting(db: ReturnType<typeof createClient>, source: Source) {
  const { data, error } = await db.from("embeddings").select("source_id, content_hash").eq(
    "source_table",
    source,
  );
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(String(row.source_id), row.content_hash as string);
  return map;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

type WorkItem = {
  sourceId: string;
  text: string;
  contentHash: string;
  metadata: Record<string, unknown>;
};

async function upsertWork(
  db: ReturnType<typeof createClient>,
  source: Source,
  work: WorkItem[],
  concurrency: number,
) {
  const batches: WorkItem[][] = [];
  for (let i = 0; i < work.length; i += BATCH_SIZE) {
    batches.push(work.slice(i, i + BATCH_SIZE));
  }
  let upserted = 0;
  await mapPool(batches, concurrency, async (batch) => {
    const vectors = await embedBatch(batch.map((b) => b.text));
    for (let i = 0; i < batch.length; i += 1) {
      const item = batch[i];
      const embedding = vectors[i];
      const { error } = await db.from("embeddings").upsert(
        {
          source_table: source,
          source_id: item.sourceId,
          content: item.text,
          content_hash: item.contentHash,
          metadata: item.metadata,
          embedding: `[${embedding.join(",")}]`,
        },
        { onConflict: "source_table,source_id" },
      );
      if (error) throw new Error(error.message);
      upserted += 1;
    }
  });
  return upserted;
}

async function backfill(
  db: ReturnType<typeof createClient>,
  source: Source,
  opts: { force: boolean; limit: number | null; concurrency: number },
) {
  const existing = await loadExisting(db, source);
  let work: WorkItem[] = [];
  let total = 0;
  let skipped = 0;

  if (source === "menu_items") {
    const { data, error } = await db
      .from("menu_items")
      .select(
        "id, name, category, description, is_veg, is_available, tags, canonical_key, restaurant_id, restaurants(name)",
      )
      .order("id");
    if (error) throw new Error(error.message);
    let rows = data ?? [];
    if (opts.limit != null) rows = rows.slice(0, opts.limit);
    total = rows.length;
    for (const r of rows as any[]) {
      const text = buildMenuItemText(r, r.restaurants);
      if (!text) {
        skipped += 1;
        continue;
      }
      const contentHash = hashContent(text);
      const sid = String(r.id);
      if (!opts.force && existing.get(sid) === contentHash) {
        skipped += 1;
        continue;
      }
      work.push({
        sourceId: sid,
        text,
        contentHash,
        metadata: {
          restaurant_id: r.restaurant_id ?? null,
          category: r.category ?? null,
          is_veg: r.is_veg === true,
          canonical_key: r.canonical_key ?? null,
          tags: Array.isArray(r.tags) ? r.tags : [],
          is_available: r.is_available !== false,
        },
      });
    }
  } else {
    const { data, error } = await db.from("ratings").select("id, comment, food_rating, restaurant_id").order(
      "id",
    );
    if (error) throw new Error(error.message);
    let rows = (data ?? []).filter((r) => String((r as any).comment || "").trim().length > 0);
    if (opts.limit != null) rows = rows.slice(0, opts.limit);
    total = rows.length;
    for (const r of rows as any[]) {
      const text = String(r.comment || "").trim();
      if (!text) {
        skipped += 1;
        continue;
      }
      const contentHash = hashContent(text);
      const sid = String(r.id);
      if (!opts.force && existing.get(sid) === contentHash) {
        skipped += 1;
        continue;
      }
      work.push({
        sourceId: sid,
        text,
        contentHash,
        metadata: {
          restaurant_id: r.restaurant_id ?? null,
          food_rating: r.food_rating ?? null,
        },
      });
    }
  }

  console.log(
    `Backfilling ${source}: candidates=${total} to_embed=${work.length} skipped=${skipped}`,
  );
  const upserted = await upsertWork(db, source, work, opts.concurrency);
  return { upserted, skipped, total };
}

const sourceArg = argValue("--source") ?? "all";
const sources: Source[] = sourceArg === "all" ? SOURCES : [sourceArg as Source];
for (const s of sources) {
  if (!SOURCES.includes(s)) {
    console.error(`Usage: --source ${SOURCES.join("|")}|all [--force] [--limit N] [--concurrency N]`);
    Deno.exit(1);
  }
}

const force = hasFlag("--force");
const limitRaw = argValue("--limit");
const limit = limitRaw != null ? Number(limitRaw) : null;
if (limitRaw != null && (!Number.isFinite(limit) || (limit as number) < 1)) {
  console.error("--limit must be a positive number");
  Deno.exit(1);
}
const concurrencyRaw = argValue("--concurrency");
const concurrency = concurrencyRaw != null ? Number(concurrencyRaw) : DEFAULT_CONCURRENCY;
if (!Number.isFinite(concurrency) || concurrency < 1) {
  console.error("--concurrency must be a positive number");
  Deno.exit(1);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  Deno.exit(1);
}
if (!Deno.env.get("OLLAMA_BASE_URL")?.trim()) {
  console.error("Set OLLAMA_BASE_URL (e.g. https://ollama.buildyourai.consulting).");
  Deno.exit(1);
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const opts = { force, limit, concurrency };
const t0 = Date.now();
let grand = { total: 0, upserted: 0, skipped: 0 };
for (const source of sources) {
  console.log(`Backfilling embeddings for ${source}…`);
  const result = await backfill(db, source, opts);
  console.log(`Done. total=${result.total} upserted=${result.upserted} skipped=${result.skipped}`);
  grand.total += result.total;
  grand.upserted += result.upserted;
  grand.skipped += result.skipped;
}
const elapsedMs = Date.now() - t0;
console.log(`Elapsed ${(elapsedMs / 1000).toFixed(1)}s for ${grand.upserted} upserted.`);
if (grand.upserted > 0) {
  const perItem = elapsedMs / grand.upserted;
  const est20kSec = (perItem * 20000) / 1000;
  console.log(`Estimate for 20,000 items: ~${(est20kSec / 60).toFixed(1)} min (${est20kSec.toFixed(0)}s).`);
}
