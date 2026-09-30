/**
 * Embeddings helper — always Ollama nomic-embed-text (768-d).
 *
 * Chat provider (Groq vs Ollama) can switch freely; the RAG index cannot.
 * Mixing embedding models would make cosine search meaningless across rows.
 */

export const EMBEDDING_MODEL = "nomic-embed-text";
export const EMBEDDING_DIMENSIONS = 768;

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function ollamaBaseUrl() {
  const host = Deno.env.get("OLLAMA_BASE_URL")?.trim() || "http://127.0.0.1:11434";
  return trimSlash(host);
}

/**
 * Call Ollama's native /api/embed endpoint and return a 768-float vector.
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
  similarity: number;
  preview: string;
  meta: Record<string, unknown>;
};

/**
 * Embed a query with the same model as the index, then cosine-search via match_embeddings.
 * That is the RAG step: answers must come from these rows, not the model's food trivia.
 */
export async function retrieveContext(
  db: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  },
  query: string,
  topK = 5,
  filterSource: string[] | null = null,
): Promise<RetrievedChunk[]> {
  const q = query.trim().slice(0, 500);
  if (!q) return [];

  const embedding = await embedText(q);
  const { data, error } = await db.rpc("match_embeddings", {
    query_embedding: `[${embedding.join(",")}]`,
    match_count: Math.min(Math.max(topK, 1), 20),
    filter_source: filterSource,
  });
  if (error) throw new Error(error.message || "match_embeddings failed");

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    source_table: String(row.source_table ?? ""),
    source_id: String(row.source_id ?? ""),
    similarity: Number(row.similarity ?? 0),
    preview: String(row.preview ?? ""),
    meta: row.meta && typeof row.meta === "object" ? (row.meta as Record<string, unknown>) : {},
  }));
}
