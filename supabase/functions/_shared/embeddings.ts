/**
 * Embeddings helper — Ollama qwen3-embedding:0.6b (1024-d).
 *
 * Chat provider (Groq vs Ollama) can switch freely; the RAG index cannot.
 * Mixing embedding models would make cosine search meaningless across rows.
 *
 * Retrieval path (A3-T4): match_embeddings_hybrid (vector + FTS + trigram RRF)
 * then LLM listwise re-rank with a deterministic heuristic fallback.
 */

export const EMBEDDING_MODEL = "qwen3-embedding:0.6b";
export const EMBEDDING_DIMENSIONS = 1024;

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function ollamaBaseUrl() {
  const host = Deno.env.get("OLLAMA_BASE_URL")?.trim() || "http://127.0.0.1:11434";
  return trimSlash(host);
}

/**
 * Call Ollama's native /api/embed endpoint and return a 1024-float vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const input = text.trim();
  if (!input) throw new Error("embedText requires non-empty text.");

  const response = await fetch(`${ollamaBaseUrl()}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = typeof body?.error === "string" ? body.error : "";
    } catch {
      detail = "";
    }
    throw new Error(
      detail
        ? `Ollama embed failed: ${detail}`
        : `Ollama embed failed (${response.status}).`,
    );
  }

  const body = await response.json();
  const vector: unknown =
    Array.isArray(body?.embeddings?.[0])
      ? body.embeddings[0]
      : Array.isArray(body?.embedding)
        ? body.embedding
        : null;

  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS}-d embedding from ${EMBEDDING_MODEL}, got ${
        Array.isArray(vector) ? vector.length : "none"
      }.`,
    );
  }

  return vector.map((n) => Number(n));
}

export type RetrievedChunk = {
  source_table: string;
  source_id: string;
  /** Hybrid RRF fusion score (or cosine when mapped from legacy). */
  similarity: number;
  /** Raw cosine similarity when the RPC provides it. */
  vector_similarity: number;
  preview: string;
  meta: Record<string, unknown>;
};

export type RetrieveDb = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  /** Needed for LLM re-rank (reads llm_config). */
  from?: (table: string) => unknown;
};

export type RetrieveOptions = {
  isVeg?: boolean | null;
  category?: string | null;
  /** Default true — LLM re-rank with heuristic fallback. */
  rerank?: boolean;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Deterministic re-rank: blend normalized hybrid score with query↔preview token overlap.
 * Keep in sync with scripts/eval-rag.mjs heuristic for hybrid+rerank mode.
 */
export function heuristicRerank(
  query: string,
  chunks: RetrievedChunk[],
  topK: number,
): RetrievedChunk[] {
  if (chunks.length <= 1) return chunks.slice(0, topK);

  const qTokens = new Set(tokenize(query));
  const scores = chunks.map((c) => Number(c.similarity) || 0);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const span = maxS - minS;

  const ranked = chunks
    .map((c) => {
      const norm = span > 1e-9 ? (Number(c.similarity) - minS) / span : 1;
      const previewTokens = tokenize(c.preview);
      let overlap = 0;
      if (qTokens.size && previewTokens.length) {
        let hit = 0;
        for (const t of previewTokens) {
          if (qTokens.has(t)) hit += 1;
        }
        overlap = hit / qTokens.size;
      }
      return { chunk: c, blend: 0.55 * norm + 0.45 * Math.min(1, overlap) };
    })
    .sort((a, b) => b.blend - a.blend || b.chunk.similarity - a.chunk.similarity);

  return ranked.slice(0, topK).map((r) => r.chunk);
}

function parseIdOrder(raw: string, allowed: Set<string>): string[] {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      const id = String(item ?? "").trim();
      if (!id || !allowed.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  } catch {
    return [];
  }
}

async function llmRerank(
  db: RetrieveDb,
  query: string,
  chunks: RetrievedChunk[],
  topK: number,
): Promise<RetrievedChunk[] | null> {
  if (!db.from || chunks.length <= 1) return null;

  const lines = chunks.map(
    (c, i) => `${i + 1}. ${c.source_id} | ${c.preview.slice(0, 160)}`,
  );
  const prompt =
    `Rank menu candidates by relevance to the customer query. ` +
    `Return ONLY a JSON array of source_id strings, best first. No prose.\n` +
    `Query: ${query.slice(0, 200)}\n` +
    `Candidates:\n${lines.join("\n")}`;

  try {
    const { callLLM } = await import("./llm.ts");
    const result = await callLLM({
      db: db as { from: (table: string) => unknown },
      messages: [
        {
          role: "system",
          content: "You re-rank food search results. Output JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 400,
    });

    if (!result.response.ok) return null;
    const content = String(result.payload?.choices?.[0]?.message?.content ?? "");
    const allowed = new Set(chunks.map((c) => c.source_id));
    const order = parseIdOrder(content, allowed);
    if (!order.length) return null;

    const byId = new Map(chunks.map((c) => [c.source_id, c]));
    const ordered: RetrievedChunk[] = [];
    for (const id of order) {
      const c = byId.get(id);
      if (c) ordered.push(c);
    }
    for (const c of chunks) {
      if (!order.includes(c.source_id)) ordered.push(c);
    }
    return ordered.slice(0, topK);
  } catch {
    return null;
  }
}

export async function rerankChunks(
  db: RetrieveDb,
  query: string,
  chunks: RetrievedChunk[],
  topK: number,
): Promise<RetrievedChunk[]> {
  if (chunks.length <= topK && chunks.length <= 1) return chunks.slice(0, topK);

  const llm = await llmRerank(db, query, chunks, topK);
  if (llm?.length) return llm;
  return heuristicRerank(query, chunks, topK);
}

/**
 * Embed a query, hybrid-search (vector + FTS + trigram), optional re-rank.
 * Answers must come from these rows, not the model's food trivia.
 */
export async function retrieveContext(
  db: RetrieveDb,
  query: string,
  topK = 5,
  opts: RetrieveOptions | null = null,
): Promise<RetrievedChunk[]> {
  const q = query.trim().slice(0, 500);
  if (!q) return [];

  const wantRerank = opts?.rerank !== false;
  const fetchCount = wantRerank
    ? Math.min(Math.max(topK * 3, 15), 20)
    : Math.min(Math.max(topK, 1), 20);

  const embedding = await embedText(q);
  const args: Record<string, unknown> = {
    query_text: q,
    query_embedding: `[${embedding.join(",")}]`,
    match_count: fetchCount,
  };
  if (typeof opts?.isVeg === "boolean") args.filter_is_veg = opts.isVeg;
  if (typeof opts?.category === "string" && opts.category.trim()) {
    args.filter_category = opts.category.trim();
  }

  const { data, error } = await db.rpc("match_embeddings_hybrid", args);
  if (error) throw new Error(error.message || "match_embeddings_hybrid failed");

  const rows = Array.isArray(data) ? data : [];
  const chunks: RetrievedChunk[] = rows.map((row: Record<string, unknown>) => ({
    source_table: String(row.source_table ?? "menu_items"),
    source_id: String(row.source_id ?? ""),
    similarity: Number(row.score ?? row.similarity ?? 0),
    vector_similarity: Number(row.vector_similarity ?? row.similarity ?? 0),
    preview: String(row.content ?? row.preview ?? ""),
    meta: row.meta && typeof row.meta === "object"
      ? (row.meta as Record<string, unknown>)
      : {},
  })).filter((c) => c.source_id);

  if (!wantRerank) return chunks.slice(0, topK);
  return rerankChunks(db, q, chunks, topK);
}
