import { createClient } from "@supabase/supabase-js";
import { DELIVERY_MAX_KM } from "../_shared/cartMath.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { embedText } from "../_shared/embeddings.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { requestLog } from "../_shared/requestLog.ts";
import { haversineKm } from "../_shared/rules.ts";
import {
  analyzeFoodImage,
  buildVisionSearchQuery,
  type VisionAnalysis,
} from "../_shared/vision.ts";

export type VisionMatchedDish = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantOpen: boolean;
  distanceKm: number | null;
  offerPercent: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isVeg: boolean;
  category: string;
  tags: string[];
  similarity: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RestaurantBrowseRow = {
  id: string;
  name: string;
  is_open: boolean;
  lat: number | null;
  lng: number | null;
  offer_percent: number | null;
};

type MenuItemRow = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
  is_synthetic?: boolean;
  category: string | null;
  tags: string[] | null;
};

async function searchCatalogForAnalysis(opts: {
  db: ReturnType<typeof createClient>;
  analysis: VisionAnalysis;
  lat: number | null;
  lng: number | null;
  vegOnly: boolean;
  limit: number;
}): Promise<VisionMatchedDish[]> {
  const { db, analysis, lat, lng, vegOnly, limit } = opts;
  const searchQuery = buildVisionSearchQuery(analysis);

  // 1. Load real (non-synthetic) restaurants from restaurant_browse
  const { data: restRows } = await db
    .from("restaurant_browse")
    .select("id, name, is_open, lat, lng, offer_percent");

  const restaurantsById = new Map<
    string,
    RestaurantBrowseRow & { distanceKm: number | null; inRange: boolean }
  >();

  const hasCoords =
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng);

  for (const raw of (restRows ?? []) as RestaurantBrowseRow[]) {
    let dist: number | null = null;
    if (hasCoords && typeof raw.lat === "number" && typeof raw.lng === "number") {
      dist = Number(haversineKm(lat!, lng!, raw.lat, raw.lng).toFixed(2));
    }
    const inRange = dist === null ? true : dist <= DELIVERY_MAX_KM;
    if (!inRange) continue;
    restaurantsById.set(raw.id, {
      ...raw,
      distanceKm: dist,
      inRange,
    });
  }

  if (restaurantsById.size === 0) {
    return [];
  }

  // 2. Hybrid pgvector + FTS + trigram search via match_embeddings_hybrid
  const scoreById = new Map<string, number>();
  try {
    const vector = await embedText(searchQuery);
    const rpcArgs: Record<string, unknown> = {
      query_text: searchQuery,
      query_embedding: `[${vector.join(",")}]`,
      match_count: 20,
    };
    if (vegOnly) rpcArgs.filter_is_veg = true;

    const { data: hybridRows } = await db.rpc("match_embeddings_hybrid", rpcArgs);
    if (Array.isArray(hybridRows)) {
      for (const row of hybridRows as Array<Record<string, unknown>>) {
        const id = String(row.source_id ?? "");
        const sim = Number(row.vector_similarity ?? row.score ?? 0.7);
        if (id) scoreById.set(id, sim);
      }
    }
  } catch {
    // Soft fallback to lexical search below if embedding endpoint is unreachable
  }

  // 3. Hydrate candidate menu items from real in-range restaurants
  const allowedRestaurantIds = Array.from(restaurantsById.keys());
  let query = db
    .from("menu_items")
    .select("id, restaurant_id, name, description, price, image_url, is_veg, is_available, is_synthetic, category, tags")
    .eq("is_available", true)
    .in("restaurant_id", allowedRestaurantIds)
    .limit(160);

  if (vegOnly) {
    query = query.eq("is_veg", true);
  }

  const { data: menuRows } = await query;
  const items = ((menuRows ?? []) as MenuItemRow[]).filter((m) => !m.is_synthetic);

  const dishTokens = analysis.dishName
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const tagSet = new Set(analysis.tags.map((t) => t.toLowerCase()));
  const catLower = analysis.category.toLowerCase();

  const scored: VisionMatchedDish[] = [];

  for (const item of items) {
    const rest = restaurantsById.get(item.restaurant_id);
    if (!rest) continue;

    const nameLower = item.name.toLowerCase();
    const descLower = (item.description ?? "").toLowerCase();
    const itemCatLower = (item.category ?? "").toLowerCase();
    const itemTags = Array.isArray(item.tags) ? item.tags.map((t) => t.toLowerCase()) : [];

    let lexicalScore = 0;
    if (analysis.dishName && nameLower === analysis.dishName.toLowerCase()) {
      lexicalScore += 0.95;
    } else if (analysis.dishName && nameLower.includes(analysis.dishName.toLowerCase())) {
      lexicalScore += 0.8;
    } else if (dishTokens.length > 0) {
      let tokenHits = 0;
      for (const tok of dishTokens) {
        if (nameLower.includes(tok)) tokenHits += 1;
        else if (descLower.includes(tok)) tokenHits += 0.4;
      }
      lexicalScore += (tokenHits / dishTokens.length) * 0.65;
    }

    if (itemCatLower && (itemCatLower === catLower || itemCatLower.includes(catLower))) {
      lexicalScore += 0.2;
    }

    let tagMatches = 0;
    for (const t of itemTags) {
      if (tagSet.has(t)) tagMatches += 1;
    }
    for (const t of tagSet) {
      if (nameLower.includes(t) || descLower.includes(t)) tagMatches += 0.5;
    }
    if (tagMatches > 0) {
      lexicalScore += Math.min(0.25, tagMatches * 0.08);
    }

    if (item.is_veg === analysis.isVeg) {
      lexicalScore += 0.08;
    }

    const vectorScore = scoreById.get(item.id) ?? 0;
    const combined = vectorScore > 0 ? Math.max(vectorScore, 0.55 * vectorScore + 0.45 * lexicalScore) : lexicalScore;

    if (combined < 0.22) continue;

    scored.push({
      id: item.id,
      restaurantId: item.restaurant_id,
      restaurantName: rest.name,
      restaurantOpen: Boolean(rest.is_open),
      distanceKm: rest.distanceKm,
      offerPercent: Number(rest.offer_percent ?? 0),
      name: item.name,
      description: item.description ?? "",
      price: Number(item.price),
      imageUrl: item.image_url ?? "",
      isVeg: Boolean(item.is_veg),
      category: item.category ?? "Main Course",
      tags: Array.isArray(item.tags) ? item.tags : [],
      similarity: Number(Math.min(0.99, combined).toFixed(3)),
    });
  }

  scored.sort((a, b) => {
    if (a.restaurantOpen !== b.restaurantOpen) return a.restaurantOpen ? -1 : 1;
    if (Math.abs(b.similarity - a.similarity) > 0.04) return b.similarity - a.similarity;
    return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
  });

  return scored.slice(0, limit);
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const started = Date.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    requestLog({ fn: "vision-food", requestId, ms: Date.now() - started, ok: false, error: "method_not_allowed" });
    return json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "POST only." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!supabaseUrl || !anonKey) {
    return json({ ok: false, code: "SERVER_MISCONFIGURED", error: "Supabase environment is missing." }, 500);
  }

  const db = createClient(supabaseUrl, anonKey, {
    global: authHeader ? { headers: { Authorization: authHeader } } : {},
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Identify caller for rate limiting (allow authenticated users; fallback to IP/anon key for guest Explore browse)
  let rateKey = "anon";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const { data: userData } = await db.auth.getUser(token);
    if (userData?.user?.id) {
      rateKey = userData.user.id;
    }
  }

  const rateLimit = Number(Deno.env.get("VISION_RATE_LIMIT") ?? "20");
  const rateWindowMs = Number(Deno.env.get("VISION_RATE_WINDOW_MS") ?? "60000");
  const rl = checkRateLimit(`vision:${rateKey}`, { limit: rateLimit, windowMs: rateWindowMs });
  if (!rl.ok) {
    requestLog({ fn: "vision-food", requestId, userId: rateKey, ms: Date.now() - started, ok: false, error: "rate_limited" });
    return json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: "You're scanning photos too quickly. Please wait a moment and try again.",
      },
      429,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "INVALID_JSON", error: "Invalid request payload." }, 400);
  }

  const mode = body.mode === "autotag" ? "autotag" : "search";
  const imageInput =
    typeof body.imageDataUrl === "string" && body.imageDataUrl.trim()
      ? body.imageDataUrl.trim()
      : typeof body.imageUrl === "string" && body.imageUrl.trim()
        ? body.imageUrl.trim()
        : "";

  const dishNameHint = typeof body.dishNameHint === "string" ? body.dishNameHint : null;
  const descriptionHint = typeof body.descriptionHint === "string" ? body.descriptionHint : null;
  const categoryHint = typeof body.categoryHint === "string" ? body.categoryHint : null;

  const analyzed = await analyzeFoodImage({
    imageUrlOrData: imageInput,
    dishNameHint,
    descriptionHint,
    categoryHint,
  });

  if (!analyzed.ok) {
    requestLog({ fn: "vision-food", requestId, userId: rateKey, ms: Date.now() - started, ok: false, error: analyzed.code });
    return json(
      {
        ok: false,
        code: analyzed.code,
        error: analyzed.message,
      },
      analyzed.status,
    );
  }

  const { analysis } = analyzed;

  if (mode === "autotag") {
    requestLog({ fn: "vision-food", requestId, userId: rateKey, ms: Date.now() - started, ok: true });
    return json({
      ok: true,
      mode: "autotag",
      analysis,
    });
  }

  if (!analysis.isFood) {
    requestLog({ fn: "vision-food", requestId, userId: rateKey, ms: Date.now() - started, ok: true });
    return json({
      ok: true,
      mode: "search",
      analysis,
      dishes: [],
      noticeCode: "NOT_FOOD_IMAGE",
      notice: "We couldn't spot a dish in that photo. Try taking a closer picture of the food.",
    });
  }

  const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
  const vegOnly = body.vegOnly === true;
  const limit = typeof body.limit === "number" ? Math.min(Math.max(body.limit, 1), 16) : 9;

  const dishes = await searchCatalogForAnalysis({
    db,
    analysis,
    lat,
    lng,
    vegOnly,
    limit,
  });

  requestLog({ fn: "vision-food", requestId, userId: rateKey, ms: Date.now() - started, ok: true });
  return json({
    ok: true,
    mode: "search",
    analysis,
    dishes,
    ...(dishes.length === 0
      ? {
          noticeCode: "NO_MATCHES_IN_RANGE",
          notice: `Detected ${analysis.dishName}, but no open kitchens within 8 km have a match right now.`,
        }
      : {}),
  });
});
