/**
 * Shared Multimodal / Vision helper for Supabase Edge Functions.
 *
 * Supports:
 * 1. Primary Vision LLM (Groq Llama-4-Scout or Cloud Ollama Vision model)
 * 2. Automatic failover between Ollama Vision and Groq Vision
 * 3. Deterministic heuristic fallback when dishNameHint / descriptionHint exist
 * 4. Strict JSON parsing + tag normalization
 */

import {
  buildVisionSearchQuery,
  inferAttributesFromText,
  normalizeFoodTags,
  normalizeMenuCategory,
  normalizeSpiceLevel,
  validateImageDataUrl,
  type CanonicalMenuCategory,
  type SpiceLevel,
  type VisionAnalysis,
} from "../../../packages/domain/src/vision.ts";

export {
  buildVisionSearchQuery,
  inferAttributesFromText,
  normalizeFoodTags,
  normalizeMenuCategory,
  normalizeSpiceLevel,
  validateImageDataUrl,
  type CanonicalMenuCategory,
  type SpiceLevel,
  type VisionAnalysis,
};

export type AnalyzeFoodImageOptions = {
  /** Base64 data URL (`data:image/jpeg;base64,...`) or remote `https://` image URL. */
  imageUrlOrData: string;
  /** Optional hint (e.g. when a manager is adding/editing a named dish). */
  dishNameHint?: string | null;
  descriptionHint?: string | null;
  categoryHint?: string | null;
  /** Optional custom fetch for unit tests. */
  fetchImpl?: typeof fetch;
};

const DEFAULT_GROQ_VISION_MODEL = "qwen/qwen3.8-27b";
const DEFAULT_OLLAMA_VISION_MODEL = "huihui_ai/Qwen3.8-abliterated:latest";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

const VISION_SYSTEM_PROMPT =
  `You are QuickBite's food vision analyzer. Inspect the image carefully and output ONLY a valid JSON object (no markdown fences, no prose) with these exact fields:\n` +
  `{\n` +
  `  "isFood": boolean,\n` +
  `  "dishName": string (specific Indian or global dish name, e.g. "Masala Dosa", "Chicken Dum Biryani", "Paneer Butter Masala", "Gulab Jamun"; empty string if not food),\n` +
  `  "cuisine": string (e.g. "South Indian", "North Indian", "Goan", "Chinese", "Italian", "Street Food", "Continental"),\n` +
  `  "category": "Starters" | "Main Course" | "Biryani" | "Breads" | "Rice" | "South Indian" | "Desserts" | "Drinks",\n` +
  `  "isVeg": boolean (true if vegetarian, false if meat/chicken/fish/seafood/egg),\n` +
  `  "spiceLevel": "mild" | "medium" | "spicy",\n` +
  `  "tags": string[] (4 to 7 short lowercase tags from: veg, non-veg, spicy, medium-spicy, mild, sweet, tangy, creamy, crispy, smoky, cheesy, south-indian, north-indian, goan, chinese, italian, continental, street-food, biryani, curry, dosa, idli, tandoor, paneer, chicken, seafood, mutton, dal, starter, bread, rice, noodles, dessert, beverage),\n` +
  `  "caption": string (one concise sentence describing the dish appearance, ingredients, and accompaniments),\n` +
  `  "confidence": number (0.0 to 1.0)\n` +
  `}`;

export function parseVisionJson(
  rawText: string,
  hints?: {
    dishNameHint?: string | null;
    descriptionHint?: string | null;
    categoryHint?: string | null;
    provider?: string;
    model?: string;
  },
): VisionAnalysis | null {
  const cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const isFood = parsed.isFood !== false;
    const rawDishName = typeof parsed.dishName === "string" ? parsed.dishName.trim() : "";
    const dishName = rawDishName || (hints?.dishNameHint ?? "").trim();

    if (!isFood && !dishName) {
      return {
        isFood: false,
        dishName: "",
        cuisine: "",
        category: "Main Course",
        isVeg: true,
        spiceLevel: "medium",
        tags: [],
        caption: typeof parsed.caption === "string" ? parsed.caption.trim() : "No food detected in image.",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.2,
        provider: hints?.provider ?? "vision",
        model: hints?.model ?? "vision",
      };
    }

    const textInferred = inferAttributesFromText({
      name: `${dishName} ${hints?.dishNameHint ?? ""}`,
      description: `${typeof parsed.caption === "string" ? parsed.caption : ""} ${hints?.descriptionHint ?? ""}`,
      category: typeof parsed.category === "string" ? parsed.category : hints?.categoryHint,
      isVeg: typeof parsed.isVeg === "boolean" ? parsed.isVeg : null,
    });

    const isVeg = typeof parsed.isVeg === "boolean" ? parsed.isVeg : textInferred.isVeg;
    const category = normalizeMenuCategory(
      parsed.category ?? hints?.categoryHint,
      `${dishName} ${typeof parsed.caption === "string" ? parsed.caption : ""}`,
    );
    const rawTagList = Array.isArray(parsed.tags) ? parsed.tags : [];
    const mergedRawTags = [...rawTagList, ...textInferred.tags];
    const spiceLevel = normalizeSpiceLevel(parsed.spiceLevel ?? textInferred.spiceLevel, mergedRawTags.map(String));
    const tags = normalizeFoodTags(mergedRawTags, { isVeg, spiceLevel, maxTags: 8 });
    const cuisine =
      typeof parsed.cuisine === "string" && parsed.cuisine.trim()
        ? parsed.cuisine.trim()
        : textInferred.cuisine;
    const caption =
      typeof parsed.caption === "string" && parsed.caption.trim()
        ? parsed.caption.trim().slice(0, 240)
        : `${cuisine} ${dishName || category} (${isVeg ? "Vegetarian" : "Non-vegetarian"})`.trim();
    const confidence =
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0.1, Number(parsed.confidence.toFixed(2))))
        : 0.85;

    return {
      isFood: true,
      dishName: dishName || category,
      cuisine,
      category,
      isVeg,
      spiceLevel,
      tags,
      caption,
      confidence,
      provider: hints?.provider ?? "vision",
      model: hints?.model ?? "vision",
    };
  } catch {
    return null;
  }
}

/**
 * Convert a remote https:// image URL into a base64 data URL if needed by Ollama/Groq.
 */
export async function resolveImageToDataUrl(
  imageUrlOrData: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; dataUrl: string } | { ok: false; code: string; message: string }> {
  const trimmed = imageUrlOrData.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "IMAGE_MISSING",
      message: "Please choose a clear food photo (JPG, PNG, or WebP under 4 MB).",
    };
  }

  if (trimmed.startsWith("data:")) {
    const valid = validateImageDataUrl(trimmed);
    if (!valid.ok) return valid;
    return { ok: true, dataUrl: `data:${valid.mime};base64,${valid.base64}` };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const res = await fetchImpl(trimmed);
      if (!res.ok) {
        return {
          ok: false,
          code: "IMAGE_FETCH_FAILED",
          message: "Could not load the dish photo URL. Please upload a file directly.",
        };
      }
      const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim().toLowerCase();
      const mime =
        contentType === "image/png" || contentType === "image/webp" || contentType === "image/jpeg"
          ? contentType
          : "image/jpeg";
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > 4 * 1024 * 1024) {
        return {
          ok: false,
          code: "IMAGE_TOO_LARGE",
          message: "That photo is over 4 MB. Please pick a smaller image.",
        };
      }
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      const b64 = btoa(binary);
      return { ok: true, dataUrl: `data:${mime};base64,${b64}` };
    } catch {
      return {
        ok: false,
        code: "IMAGE_FETCH_FAILED",
        message: "Could not download the photo for analysis. Check the image URL and try again.",
      };
    }
  }

  return {
    ok: false,
    code: "IMAGE_INVALID_FORMAT",
    message: "Unsupported photo format. Please use a JPG, PNG, or WebP image.",
  };
}

async function callOpenAiCompatibleVision(opts: {
  provider: "groq" | "ollama";
  baseUrl: string;
  apiKey?: string;
  model: string;
  dataUrl: string;
  userPrompt: string;
  fetchImpl: typeof fetch;
  timeoutMs?: number;
}): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 18_000);

  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;

    const res = await opts.fetchImpl(`${trimSlash(opts.baseUrl)}/chat/completions`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.1,
        max_tokens: 450,
        messages: [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: opts.userPrompt },
              { type: "image_url", image_url: { url: opts.dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Analyze a food image using Groq Vision and/or Cloud Ollama Vision with automatic failover.
 */
export async function analyzeFoodImage(
  options: AnalyzeFoodImageOptions,
): Promise<
  | { ok: true; analysis: VisionAnalysis }
  | { ok: false; code: string; message: string; status: number }
> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolved = await resolveImageToDataUrl(options.imageUrlOrData, fetchImpl);
  if (!resolved.ok) {
    return { ok: false, code: resolved.code, message: resolved.message, status: 400 };
  }

  const hintLines: string[] = [
    "Identify the food dish in this image, its cuisine, category, whether it is vegetarian, spice level, and 4-7 canonical tags.",
  ];
  if (options.dishNameHint?.trim()) {
    hintLines.push(`Dish name hint from kitchen: "${options.dishNameHint.trim()}".`);
  }
  if (options.descriptionHint?.trim()) {
    hintLines.push(`Description hint: "${options.descriptionHint.trim()}".`);
  }
  if (options.categoryHint?.trim()) {
    hintLines.push(`Category hint: "${options.categoryHint.trim()}".`);
  }
  const userPrompt = hintLines.join(" ");

  const groqKey = Deno.env.get("GROQ_API_KEY")?.trim();
  const groqModel = Deno.env.get("GROQ_VISION_MODEL")?.trim() || DEFAULT_GROQ_VISION_MODEL;
  const ollamaHost = Deno.env.get("OLLAMA_BASE_URL")?.trim();
  const ollamaModel = Deno.env.get("OLLAMA_VISION_MODEL")?.trim() || DEFAULT_OLLAMA_VISION_MODEL;

  const attempts: Array<{
    provider: "groq" | "ollama";
    baseUrl: string;
    apiKey?: string;
    model: string;
  }> = [];

  if (groqKey) {
    attempts.push({
      provider: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groqKey,
      model: groqModel,
    });
  }
  if (ollamaHost) {
    attempts.push({
      provider: "ollama",
      baseUrl: `${trimSlash(ollamaHost)}/v1`,
      model: ollamaModel,
    });
  }

  for (const attempt of attempts) {
    const raw = await callOpenAiCompatibleVision({
      ...attempt,
      dataUrl: resolved.dataUrl,
      userPrompt,
      fetchImpl,
    });
    if (!raw) continue;
    const parsed = parseVisionJson(raw, {
      dishNameHint: options.dishNameHint,
      descriptionHint: options.descriptionHint,
      categoryHint: options.categoryHint,
      provider: attempt.provider,
      model: attempt.model,
    });
    if (parsed) {
      return { ok: true, analysis: parsed };
    }
  }

  // Resilient fallback when a dish name or description hint is provided (e.g. manager auto-tag)
  if (options.dishNameHint?.trim() || options.descriptionHint?.trim()) {
    const inferred = inferAttributesFromText({
      name: options.dishNameHint,
      description: options.descriptionHint,
      category: options.categoryHint,
    });
    const dishName = options.dishNameHint?.trim() || inferred.category;
    return {
      ok: true,
      analysis: {
        isFood: true,
        dishName,
        cuisine: inferred.cuisine,
        category: inferred.category,
        isVeg: inferred.isVeg,
        spiceLevel: inferred.spiceLevel,
        tags: inferred.tags,
        caption: `${inferred.cuisine} ${dishName} (${inferred.isVeg ? "Vegetarian" : "Non-vegetarian"})`,
        confidence: 0.72,
        provider: "heuristic-fallback",
        model: "domain-rules-v1",
      },
    };
  }

  return {
    ok: false,
    code: "VISION_UNAVAILABLE",
    message:
      "Photo analysis is temporarily busy. Please try again in a few seconds or search by dish name.",
    status: 503,
  };
}
