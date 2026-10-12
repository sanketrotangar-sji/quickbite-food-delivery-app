import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { heuristicRerank, retrieveContext, type RetrievedChunk } from "./embeddings.ts";

Deno.test("retrieveContext maps hybrid rpc rows to chunks", async () => {
  const fakeVector = Array.from({ length: 1024 }, (_, i) => i * 0.001);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({ embeddings: [fakeVector] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

  try {
    let calledFn = "";
    let calledArgs: Record<string, unknown> = {};
    const chunks = await retrieveContext(
      {
        rpc: async (fn, args) => {
          calledFn = fn;
          calledArgs = args;
          return {
            data: [
              {
                source_table: "menu_items",
                source_id: "11111111-1111-4111-8111-111111111111",
                score: 0.042,
                vector_similarity: 0.91,
                content: "Paneer Tikka · Starters · grilled cottage cheese",
              },
            ],
            error: null,
          };
        },
      },
      "vegetarian starter",
      5,
      { rerank: false },
    );
    assertEquals(calledFn, "match_embeddings_hybrid");
    assertEquals(typeof calledArgs.query_text, "string");
    assertEquals(typeof calledArgs.query_embedding, "string");
    assertEquals(chunks.length, 1);
    assertEquals(chunks[0].source_table, "menu_items");
    assertEquals(chunks[0].similarity, 0.042);
    assertEquals(chunks[0].vector_similarity, 0.91);
    assertEquals(chunks[0].preview.includes("Paneer Tikka"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("retrieveContext returns empty for blank query", async () => {
  const chunks = await retrieveContext(
    { rpc: async () => ({ data: [], error: null }) },
    "   ",
    5,
    null,
  );
  assertEquals(chunks.length, 0);
});

Deno.test("heuristicRerank prefers token overlap with query", () => {
  const chunks: RetrievedChunk[] = [
    {
      source_table: "menu_items",
      source_id: "a",
      similarity: 0.5,
      vector_similarity: 0.8,
      preview: "Butter Chicken · Mains · creamy tomato gravy",
      meta: {},
    },
    {
      source_table: "menu_items",
      source_id: "b",
      similarity: 0.5,
      vector_similarity: 0.7,
      preview: "Mint Soda · Drinks · tangy drink",
      meta: {},
    },
  ];
  // Equal hybrid scores → lexical overlap on "tangy drink" must win.
  const ranked = heuristicRerank("tangy drink", chunks, 2);
  assertEquals(ranked[0].source_id, "b");
});
