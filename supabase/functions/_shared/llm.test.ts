import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  callLLM,
  readActiveLlmConfig,
  resolveProviderEndpoint,
} from "./llm.ts";

Deno.test("resolveProviderEndpoint groq uses api key header", () => {
  Deno.env.set("GROQ_API_KEY", "test-key");
  const ep = resolveProviderEndpoint("groq", "openai/gpt-oss-20b");
  assertEquals(ep.provider, "groq");
  assertEquals(ep.baseUrl, "https://api.groq.com/openai/v1");
  assertEquals(ep.headers.authorization, "Bearer test-key");
  Deno.env.delete("GROQ_API_KEY");
});

Deno.test("resolveProviderEndpoint ollama uses host", () => {
  Deno.env.set("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
  const ep = resolveProviderEndpoint("ollama", "llama3.2");
  assertEquals(ep.provider, "ollama");
  assertEquals(ep.baseUrl, "http://127.0.0.1:11434/v1");
  Deno.env.delete("OLLAMA_BASE_URL");
});

Deno.test("readActiveLlmConfig falls back when empty", async () => {
  Deno.env.set("GROQ_API_KEY", "k");
  const row = await readActiveLlmConfig({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  });
  assertEquals(row.provider, "groq");
  Deno.env.delete("GROQ_API_KEY");
});

Deno.test("callLLM routes to groq from config without network", async () => {
  Deno.env.set("GROQ_API_KEY", "k");
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  globalThis.fetch = (input: RequestInfo | URL) => {
    calledUrl = String(input);
    return Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  };

  try {
    const result = await callLLM({
      db: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "1",
                  provider: "groq",
                  chat_model: "openai/gpt-oss-20b",
                  is_active: true,
                },
                error: null,
              }),
            }),
          }),
        }),
      },
      messages: [{ role: "user", content: "hi" }],
    });
    assertEquals(result.provider, "groq");
    assertEquals(calledUrl.includes("api.groq.com"), true);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("GROQ_API_KEY");
  }
});

Deno.test("resolveProviderEndpoint groq missing key throws", () => {
  Deno.env.delete("GROQ_API_KEY");
  assertThrows(() => resolveProviderEndpoint("groq", "m"), Error);
});
