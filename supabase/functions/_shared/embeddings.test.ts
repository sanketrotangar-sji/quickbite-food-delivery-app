import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { retrieveContext } from "./embeddings.ts";

Deno.test("retrieveContext maps rpc rows to chunks", async () => {
  const fakeVector = Array.from({ length: 768 }, (_, i) => i * 0.001);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({ embeddings: [fakeVector] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

  try {
    const chunks = await retrieveContext(
      {
        rpc: async (_fn, args) => {
          assertEquals(typeof args.query_embedding, "string");
          return {
            data: [
              {
                source_table: "menu_items",
                source_id: "11111111-1111-4111-8111-111111111111",
                similarity: 0.91,
                preview: "Paneer Tikka · Starters",
                meta: { name: "Paneer Tikka", price: 180 },
              },
            ],
            error: null,
          };
        },
      },
      "vegetarian starter",
      5,
      ["menu_items"],
    );
    assertEquals(chunks.length, 1);
    assertEquals(chunks[0].source_table, "menu_items");
    assertEquals(chunks[0].meta.name, "Paneer Tikka");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("retrieveContext returns empty for blank query", async () => {
  const chunks = await retrieveContext({ rpc: async () => ({ data: [], error: null }) }, "   ", 5, null);
  assertEquals(chunks.length, 0);
});
