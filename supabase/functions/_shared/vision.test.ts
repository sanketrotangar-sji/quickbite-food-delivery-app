import {
  analyzeFoodImage,
  buildVisionSearchQuery,
  parseVisionJson,
  resolveImageToDataUrl,
  validateImageDataUrl,
} from "./vision.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}

Deno.test("parseVisionJson extracts structured VisionAnalysis and normalizes tags", () => {
  const raw = `Here is the JSON:
  {
    "isFood": true,
    "dishName": "Masala Dosa",
    "cuisine": "South Indian",
    "category": "South Indian",
    "isVeg": true,
    "spiceLevel": "medium",
    "tags": ["Vegetarian", "Crispy", "South Indian", "crepe"],
    "caption": "Golden crispy fermented dosa served with coconut chutney and sambar.",
    "confidence": 0.94
  }`;

  const parsed = parseVisionJson(raw, { provider: "ollama", model: "qwen-vision" });
  assert(parsed !== null, "expected parsed analysis");
  assert(parsed.isFood === true);
  assert(parsed.dishName === "Masala Dosa");
  assert(parsed.isVeg === true);
  assert(parsed.category === "South Indian");
  assert(parsed.tags.includes("veg"));
  assert(parsed.tags.includes("crispy"));
  assert(parsed.tags.includes("south-indian"));
  assert(parsed.tags.includes("dosa"));
  assert(!parsed.tags.includes("non-veg"));
});

Deno.test("parseVisionJson handles non-food images gracefully", () => {
  const raw = `{"isFood": false, "dishName": "", "caption": "A laptop keyboard on a desk.", "confidence": 0.91}`;
  const parsed = parseVisionJson(raw);
  assert(parsed !== null);
  assert(parsed.isFood === false);
  assert(parsed.dishName === "");
  assert(parsed.tags.length === 0);
});

Deno.test("validateImageDataUrl rejects missing or invalid data URLs", () => {
  const empty = validateImageDataUrl("");
  assert(!empty.ok && empty.code === "IMAGE_MISSING");

  const badMime = validateImageDataUrl("data:application/pdf;base64,AAAA");
  assert(!badMime.ok && badMime.code === "IMAGE_INVALID_FORMAT");

  const valid = validateImageDataUrl(`data:image/png;base64,${"A".repeat(80)}`);
  assert(valid.ok && valid.mime === "image/png");
});

Deno.test("analyzeFoodImage falls back to second provider when first fails", async () => {
  Deno.env.set("GROQ_API_KEY", "test-groq-key");
  Deno.env.set("OLLAMA_BASE_URL", "http://localhost:11434");

  let callCount = 0;
  const fakeFetch: typeof fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return new Response("rate limited", { status: 429 });
    }
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isFood: true,
                dishName: "Chicken Dum Biryani",
                cuisine: "Mughlai",
                category: "Biryani",
                isVeg: false,
                spiceLevel: "spicy",
                tags: ["biryani", "chicken", "spicy", "rice"],
                caption: "Aromatic basmati rice layered with spiced chicken.",
                confidence: 0.92,
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const validImg = `data:image/jpeg;base64,${"A".repeat(80)}`;
  const res = await analyzeFoodImage({ imageUrlOrData: validImg, fetchImpl: fakeFetch });
  assert(res.ok, "expected failover to succeed");
  assert(res.analysis.dishName === "Chicken Dum Biryani");
  assert(res.analysis.isVeg === false);
  assert(res.analysis.category === "Biryani");
  assert(res.analysis.provider === "ollama");

  const query = buildVisionSearchQuery(res.analysis);
  assert(query.includes("Chicken Dum Biryani"));
});

Deno.test("resolveImageToDataUrl converts remote image URL using custom fetch", async () => {
  const fakeBytes = new Uint8Array(64);
  fakeBytes.fill(65);
  const fakeFetch: typeof fetch = async () =>
    new Response(fakeBytes, {
      status: 200,
      headers: { "content-type": "image/webp" },
    });

  const resolved = await resolveImageToDataUrl("https://example.com/dish.webp", fakeFetch);
  assert(resolved.ok);
  assert(resolved.dataUrl.startsWith("data:image/webp;base64,"));
});
