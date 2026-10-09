import { cartHash, cartTotals, DELIVERY_MAX_KM, money, STANDARD_DELIVERY_FEE } from "../_shared/cartMath.ts";
import { ticketUrgency } from "../_shared/rules.ts";
import { cachedTool } from "./_toolCache.ts";

export type RioRestaurant = {
  id: string;
  name: string;
  cuisine: string;
  dishName: string;
  imageUrl: string;
  address: string;
  isOpen: boolean;
  veg: boolean;
  offerPercent: number | null;
  prepMinutes: number | null;
  distanceKm?: number | null;
};

export type RioMenuItem = {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isVeg: boolean;
  category: string | null;
};

export type RioCard =
  | { kind: "restaurants"; places: RioRestaurant[] }
  | { kind: "menu"; restaurantId: string; restaurantName: string; items: RioMenuItem[] }
  | {
    kind: "cart";
    restaurantName: string;
    lines: { name: string; quantity: number; unitPrice: number }[];
    subtotal: number;
    offerPercent: number;
    discountAmount: number;
    deliveryFee: number;
    total: number;
    confirm: boolean;
    needsAddress: boolean;
    settled?: boolean;
    cartHash?: string;
  }
  | {
    kind: "order";
    id: string;
    restaurantName: string;
    imageUrl: string | null;
    status: string;
    total: number;
    placedAt: string;
    itemsSummary: string;
    address: string;
  }
  | {
    kind: "ticket";
    id: string;
    orderId: string;
    issueType: string;
    urgency: string;
    status: string;
  };

export type RioConflict = {
  menuItemId: string;
  itemName: string;
  currentRestaurant: string;
};

export type ToolOutcome = {
  data: Record<string, unknown>;
  cards: RioCard[];
  conflict: RioConflict | null;
};

type Db = any;

export { STANDARD_DELIVERY_FEE, DELIVERY_MAX_KM };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLOSED_QUERY = /\b(closed|shut|offline|not open)\b/i;
const ACTIVE_ORDER_STATUSES = ["placed", "preparing", "ready", "out_for_delivery"];

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function errText(error: { message?: string; details?: string; hint?: string } | null) {
  return [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
}

function isOtherRestaurant(error: { message?: string; details?: string; hint?: string } | null) {
  const blob = errText(error);
  return blob.includes("CART_OTHER_RESTAURANT") || blob.includes("different restaurant");
}

function searchTerm(raw: unknown) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[%_,().*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function wantsClosedKitchens(query: string) {
  return CLOSED_QUERY.test(query);
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type Kitchen = {
  id: string;
  name: string;
  cuisine: string | null;
  description: string | null;
  address: string;
  image_url: string | null;
  is_open: boolean;
  offer_percent: number | null;
  prep_minutes: number | null;
  lat?: number | null;
  lng?: number | null;
};

type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_veg: boolean;
  category: string | null;
  restaurant_id: string;
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Same rules as client assertWithinDeliveryRange (missing kitchen coords → skip). */
function rangeError(
  originLat: number | null,
  originLng: number | null,
  kitchen: { lat?: number | null; lng?: number | null; name?: string | null },
): string | null {
  if (originLat == null || originLng == null) {
    return "Set a delivery address with a location pin first so we can check if this kitchen is in range.";
  }
  if (kitchen.lat == null || kitchen.lng == null) return null;
  const km = haversineKm(originLat, originLng, Number(kitchen.lat), Number(kitchen.lng));
  if (!Number.isFinite(km) || km <= DELIVERY_MAX_KM) return null;
  const label = kitchen.name?.trim() || "This kitchen";
  return `${label} is about ${km.toFixed(1)} km from your address. We only deliver within ${DELIVERY_MAX_KM} km.`;
}

function parseExcludeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => isUuid(id)).slice(0, 40);
}

function diversifyPlaces(places: RioRestaurant[], limit = 8): RioRestaurant[] {
  const byCuisine = new Map<string, number>();
  const picked: RioRestaurant[] = [];
  for (const place of places) {
    const cuisine = place.cuisine.toLowerCase();
    const count = byCuisine.get(cuisine) ?? 0;
    if (count >= 2) continue;
    byCuisine.set(cuisine, count + 1);
    picked.push(place);
    if (picked.length >= limit) break;
  }
  if (picked.length < limit) {
    for (const place of places) {
      if (picked.some((row) => row.id === place.id)) continue;
      picked.push(place);
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

function diversifyDishes(dishes: Dish[], limit = 10): Dish[] {
  const perRestaurant = new Map<string, number>();
  const picked: Dish[] = [];
  for (const dish of dishes) {
    const count = perRestaurant.get(dish.restaurant_id) ?? 0;
    if (count >= 2) continue;
    perRestaurant.set(dish.restaurant_id, count + 1);
    picked.push(dish);
    if (picked.length >= limit) break;
  }
  return picked;
}

function toRestaurant(
  kitchen: Kitchen,
  dishName: string,
  veg: boolean,
  distanceKm: number | null = null,
): RioRestaurant {
  return {
    id: kitchen.id,
    name: kitchen.name,
    cuisine: kitchen.cuisine?.trim() || "Multi-cuisine",
    dishName,
    imageUrl: kitchen.image_url ?? "",
    address: kitchen.address,
    isOpen: kitchen.is_open,
    veg,
    offerPercent: kitchen.offer_percent,
    prepMinutes: kitchen.prep_minutes,
    distanceKm: distanceKm != null && Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(1)) : null,
  };
}

function kitchenDistanceKm(
  kitchen: Kitchen,
  deliveryLat: number | null,
  deliveryLng: number | null,
): number | null {
  if (
    deliveryLat == null ||
    deliveryLng == null ||
    kitchen.lat == null ||
    kitchen.lng == null ||
    !Number.isFinite(Number(kitchen.lat)) ||
    !Number.isFinite(Number(kitchen.lng))
  ) {
    return null;
  }
  return haversineKm(deliveryLat, deliveryLng, Number(kitchen.lat), Number(kitchen.lng));
}

function inDeliveryRange(
  kitchen: Kitchen,
  deliveryLat: number | null,
  deliveryLng: number | null,
): boolean {
  if (deliveryLat == null || deliveryLng == null) return true;
  const km = kitchenDistanceKm(kitchen, deliveryLat, deliveryLng);
  if (km == null) return true;
  return km <= DELIVERY_MAX_KM;
}

async function loadKitchens(db: Db, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [] as Kitchen[];
  const { data, error } = await db
    .from("restaurant_browse")
    .select("id, name, cuisine, description, address, image_url, is_open, offer_percent, prep_minutes, lat, lng")
    .in("id", unique);
  if (error) throw new Error(errText(error) || "Could not load restaurants.");
  return (data ?? []) as Kitchen[];
}

async function searchRestaurantsUncached(
  db: Db,
  args: {
    query?: unknown;
    veg_only?: unknown;
    max_price?: unknown;
    exclude_restaurant_ids?: unknown;
    delivery_lat?: unknown;
    delivery_lng?: unknown;
  },
): Promise<ToolOutcome> {
  const query = searchTerm(args.query);
  const vegOnly = args.veg_only === true;
  const maxPrice = typeof args.max_price === "number" && args.max_price > 0 ? args.max_price : null;
  const exclude = new Set(parseExcludeIds(args.exclude_restaurant_ids));
  const deliveryLat = typeof args.delivery_lat === "number" ? args.delivery_lat : null;
  const deliveryLng = typeof args.delivery_lng === "number" ? args.delivery_lng : null;
  const broad = !query && !vegOnly && maxPrice == null;
  const includeClosed = wantsClosedKitchens(query);

  // Empty browse dumps up to 40 kitchens — require food terms (or veg/price filters).
  if (broad) {
    return {
      data: {
        error: "QUERY_REQUIRED",
        message:
          "Pass a non-empty food query (dish, cuisine, or mood) to search_restaurants. Do not call with an empty query to list all kitchens. For \"show more\", keep the same query and pass exclude_restaurant_ids.",
        restaurants: [],
        dishes: [],
      },
      cards: [],
      conflict: null,
    };
  }

  const kitchenPromise = (async () => {
    if (!query) return [] as Kitchen[];
    let request = db
      .from("restaurant_browse")
      .select("id, name, cuisine, description, address, image_url, is_open, offer_percent, prep_minutes, lat, lng")
      .order("is_open", { ascending: false })
      .order("offer_percent", { ascending: false, nullsFirst: false })
      .limit(40);
    if (!includeClosed) request = request.eq("is_open", true);
    if (query) {
      request = request.or(
        `name.ilike.%${query}%,cuisine.ilike.%${query}%,description.ilike.%${query}%`,
      );
    }
    const { data, error } = await request;
    if (error) throw new Error(errText(error) || "Could not search restaurants.");
    return ((data ?? []) as Kitchen[]).filter((kitchen) => !exclude.has(kitchen.id));
  })();

  const dishPromise = (async () => {
    let request = db
      .from("menu_items")
      .select("id, name, description, price, image_url, is_available, is_veg, category, restaurant_id")
      .eq("is_available", true)
      .limit(40);
    if (query) {
      request = request.or(`name.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`);
    }
    if (vegOnly) request = request.eq("is_veg", true);
    if (maxPrice != null) request = request.lte("price", maxPrice);
    const { data, error } = await request;
    if (error) throw new Error(errText(error) || "Could not search dishes.");
    return ((data ?? []) as Dish[]).filter((dish) => !exclude.has(dish.restaurant_id));
  })();

  let [kitchens, dishes] = await Promise.all([kitchenPromise, dishPromise]);
  dishes = diversifyDishes(dishes, 12);

  const known = new Set(kitchens.map((kitchen) => kitchen.id));
  const missing = dishes.map((dish) => dish.restaurant_id).filter((id) => !known.has(id));
  if (missing.length > 0) {
    const extra = await loadKitchens(db, missing);
    kitchens = [
      ...kitchens,
      ...extra.filter((kitchen) => includeClosed || kitchen.is_open),
    ];
  }

  const dishByRestaurant = new Map<string, Dish[]>();
  for (const dish of dishes) {
    const list = dishByRestaurant.get(dish.restaurant_id) ?? [];
    list.push(dish);
    dishByRestaurant.set(dish.restaurant_id, list);
  }

  const ranked = kitchens
    .map((kitchen) => {
      if (!includeClosed && !kitchen.is_open) return null;
      if (exclude.has(kitchen.id)) return null;
      const matches = dishByRestaurant.get(kitchen.id) ?? [];
      const named = `${kitchen.name} ${kitchen.cuisine ?? ""} ${kitchen.description ?? ""}`.toLowerCase();
      const nameHit = query ? named.includes(query.toLowerCase()) : false;
      if (vegOnly && matches.length === 0) return null;
      if (maxPrice != null && matches.length === 0) return null;
      if (matches.length === 0 && !nameHit) return null;
      const featured = matches[0];
      const veg = matches.length > 0 ? matches.every((dish) => dish.is_veg) : false;
      const place = toRestaurant(kitchen, featured?.name ?? kitchen.cuisine?.trim() ?? "Menu", veg);
      const distanceKm =
        deliveryLat != null &&
        deliveryLng != null &&
        kitchen.lat != null &&
        kitchen.lng != null &&
        Number.isFinite(kitchen.lat) &&
        Number.isFinite(kitchen.lng)
          ? haversineKm(deliveryLat, deliveryLng, Number(kitchen.lat), Number(kitchen.lng))
          : null;
      return { place, distanceKm, offer: kitchen.offer_percent ?? 0 };
    })
    .filter((row): row is { place: RioRestaurant; distanceKm: number | null; offer: number } => row != null)
    .filter((row) => {
      if (deliveryLat == null || deliveryLng == null) return true;
      if (row.distanceKm == null) return true;
      return row.distanceKm <= DELIVERY_MAX_KM;
    })
    .sort((a, b) => {
      const openDelta = Number(b.place.isOpen) - Number(a.place.isOpen);
      if (openDelta !== 0) return openDelta;
      if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      if (b.offer !== a.offer) return b.offer - a.offer;
      return a.place.name.localeCompare(b.place.name);
    });

  const inRangeIds = new Set(ranked.map((row) => row.place.id));
  if (deliveryLat != null && deliveryLng != null) {
    dishes = dishes.filter((dish) => inRangeIds.has(dish.restaurant_id));
  }

  const places = diversifyPlaces(
    ranked.map((row) => row.place),
    8,
  );

  return {
    data: {
      restaurants: places.map((place) => {
        const meta = ranked.find((row) => row.place.id === place.id);
        return {
          id: place.id,
          name: place.name,
          cuisine: place.cuisine,
          is_open: place.isOpen,
          sample_dish: place.dishName,
          distance_km: meta?.distanceKm != null ? Number(meta.distanceKm.toFixed(1)) : null,
        };
      }),
      dishes: dishes.slice(0, 10).map((dish) => ({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        is_veg: dish.is_veg,
        restaurant_id: dish.restaurant_id,
      })),
    },
    cards: places.length ? [{ kind: "restaurants", places }] : [],
    conflict: null,
  };
}

export async function searchRestaurants(
  db: Db,
  args: {
    query?: unknown;
    veg_only?: unknown;
    max_price?: unknown;
    exclude_restaurant_ids?: unknown;
    delivery_lat?: unknown;
    delivery_lng?: unknown;
  },
): Promise<ToolOutcome> {
  const exclude = parseExcludeIds(args.exclude_restaurant_ids);
  const cacheArgs = {
    query: searchTerm(args.query),
    veg_only: args.veg_only === true,
    max_price: typeof args.max_price === "number" && args.max_price > 0 ? args.max_price : null,
    exclude: exclude.slice().sort().join(","),
    lat: typeof args.delivery_lat === "number" ? Math.round(args.delivery_lat * 100) / 100 : null,
    lng: typeof args.delivery_lng === "number" ? Math.round(args.delivery_lng * 100) / 100 : null,
  };
  // Skip cache when paginating (excludes) so "Show more" is not sticky.
  if (exclude.length > 0) return searchRestaurantsUncached(db, args);
  return cachedTool("search_restaurants", cacheArgs, () => searchRestaurantsUncached(db, args));
}

/** Themes near the customer — categories from open, in-range kitchens (no add cards). */
export async function browseThemes(
  db: Db,
  args: {
    veg_only?: unknown;
    delivery_lat?: unknown;
    delivery_lng?: unknown;
  },
): Promise<ToolOutcome> {
  const vegOnly = args.veg_only === true;
  const deliveryLat = typeof args.delivery_lat === "number" ? args.delivery_lat : null;
  const deliveryLng = typeof args.delivery_lng === "number" ? args.delivery_lng : null;

  const { data: kitchensRaw, error: kErr } = await db
    .from("restaurant_browse")
    .select("id, name, lat, lng, is_open")
    .eq("is_open", true)
    .limit(80);
  if (kErr) {
    return {
      data: {
        error: "Could not load kitchens nearby.",
        instruction: "Ask the customer for a dish name and call find_offers instead.",
      },
      cards: [],
      conflict: null,
    };
  }

  const kitchens = ((kitchensRaw ?? []) as Kitchen[]).filter((k) =>
    inDeliveryRange(k, deliveryLat, deliveryLng)
  );
  const kitchenIds = kitchens.map((k) => k.id);
  if (kitchenIds.length === 0) {
    return {
      data: {
        empty: true,
        themes: [],
        instruction:
          "No open kitchens in range. Ask for a delivery address pin or try again later.",
      },
      cards: [],
      conflict: null,
    };
  }

  let dishQuery = db
    .from("menu_items")
    .select("category, name, restaurant_id, is_veg, is_available")
    .eq("is_available", true)
    .in("restaurant_id", kitchenIds)
    .limit(400);
  if (vegOnly) dishQuery = dishQuery.eq("is_veg", true);
  const { data: dishes, error: dErr } = await dishQuery;
  if (dErr) {
    return {
      data: {
        error: "Could not load menu themes.",
        instruction: "Ask for a concrete dish and call find_offers.",
      },
      cards: [],
      conflict: null,
    };
  }

  const byTheme = new Map<string, Set<string>>();
  for (const row of (dishes ?? []) as {
    category: string | null;
    name: string;
    restaurant_id: string;
  }[]) {
    const theme = (row.category?.trim() || row.name?.trim() || "").slice(0, 40);
    if (!theme) continue;
    const set = byTheme.get(theme) ?? new Set<string>();
    set.add(row.restaurant_id);
    byTheme.set(theme, set);
  }

  const themes = [...byTheme.entries()]
    .map(([theme, kitchensSet]) => ({
      theme,
      kitchen_count: kitchensSet.size,
    }))
    .sort((a, b) => b.kitchen_count - a.kitchen_count || a.theme.localeCompare(b.theme))
    .slice(0, 12);

  return {
    data: {
      themes,
      open_kitchens_in_range: kitchenIds.length,
      instruction:
        "Present these themes to the customer. When they pick one, call find_offers with that theme as query. Do not invent themes.",
    },
    cards: [],
    conflict: null,
  };
}

/**
 * Per-kitchen offers for a dish/theme. One featured dish per kitchen.
 * Available+open first as cards; unavailable/closed listed in JSON for honesty.
 */
export async function findOffers(
  db: Db,
  args: {
    query?: unknown;
    veg_only?: unknown;
    max_price?: unknown;
    exclude_restaurant_ids?: unknown;
    restaurant_id?: unknown;
    delivery_lat?: unknown;
    delivery_lng?: unknown;
  },
): Promise<ToolOutcome> {
  const query = searchTerm(args.query);
  if (!query) {
    return {
      data: {
        empty: true,
        error: "QUERY_REQUIRED",
        instruction: "Need a dish or theme. Call browse_themes or ask the customer what they want.",
      },
      cards: [],
      conflict: null,
    };
  }

  const vegOnly = args.veg_only === true;
  const maxPrice = typeof args.max_price === "number" && args.max_price > 0 ? args.max_price : null;
  const exclude = new Set(parseExcludeIds(args.exclude_restaurant_ids));
  const narrowId = isUuid(args.restaurant_id) ? String(args.restaurant_id) : null;
  const deliveryLat = typeof args.delivery_lat === "number" ? args.delivery_lat : null;
  const deliveryLng = typeof args.delivery_lng === "number" ? args.delivery_lng : null;

  let dishRequest = db
    .from("menu_items")
    .select("id, name, description, price, image_url, is_available, is_veg, category, restaurant_id")
    .or(`name.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(80);
  if (narrowId) dishRequest = dishRequest.eq("restaurant_id", narrowId);
  if (vegOnly) dishRequest = dishRequest.eq("is_veg", true);
  if (maxPrice != null) dishRequest = dishRequest.lte("price", maxPrice);

  const { data: dishRows, error: dishErr } = await dishRequest;
  if (dishErr) {
    return {
      data: {
        error: "Search failed. Try a shorter dish name.",
        instruction: "Retry find_offers with a simpler query, or browse_themes.",
      },
      cards: [],
      conflict: null,
    };
  }

  let dishes = ((dishRows ?? []) as Dish[]).filter((d) => !exclude.has(d.restaurant_id));
  if (dishes.length === 0) {
    return {
      data: {
        empty: true,
        offers: [],
        unavailable_or_closed: [],
        instruction: "No matches. Suggest browse_themes or a different dish name.",
      },
      cards: [],
      conflict: null,
    };
  }

  const kitchens = await loadKitchens(
    db,
    dishes.map((d) => d.restaurant_id),
  );
  const kitchenById = new Map(kitchens.map((k) => [k.id, k]));

  type OfferRow = {
    restaurant_id: string;
    restaurant_name: string;
    is_open: boolean;
    distance_km: number | null;
    dish_id: string;
    dish_name: string;
    price: number;
    is_available: boolean;
    is_veg: boolean;
    in_range: boolean;
  };

  const bestByKitchen = new Map<string, OfferRow>();
  for (const dish of dishes) {
    const kitchen = kitchenById.get(dish.restaurant_id);
    if (!kitchen) continue;
    const distanceKm = kitchenDistanceKm(kitchen, deliveryLat, deliveryLng);
    const inRange = inDeliveryRange(kitchen, deliveryLat, deliveryLng);
    const candidate: OfferRow = {
      restaurant_id: kitchen.id,
      restaurant_name: kitchen.name,
      is_open: kitchen.is_open,
      distance_km: distanceKm != null ? Number(distanceKm.toFixed(1)) : null,
      dish_id: dish.id,
      dish_name: dish.name,
      price: Number(dish.price),
      is_available: dish.is_available === true,
      is_veg: dish.is_veg === true,
      in_range: inRange,
    };
    const prev = bestByKitchen.get(kitchen.id);
    if (!prev) {
      bestByKitchen.set(kitchen.id, candidate);
      continue;
    }
    // Prefer available + open over unavailable/closed for the featured offer.
    const score = (o: OfferRow) =>
      (o.is_available ? 4 : 0) + (o.is_open ? 2 : 0) + (o.in_range ? 1 : 0);
    if (score(candidate) > score(prev)) bestByKitchen.set(kitchen.id, candidate);
  }

  const allOffers = [...bestByKitchen.values()];
  const ready = allOffers
    .filter((o) => o.is_available && o.is_open && o.in_range)
    .sort((a, b) => {
      if (a.distance_km != null && b.distance_km != null && a.distance_km !== b.distance_km) {
        return a.distance_km - b.distance_km;
      }
      return a.restaurant_name.localeCompare(b.restaurant_name);
    });
  const soft = allOffers
    .filter((o) => !o.is_available || !o.is_open || !o.in_range)
    .slice(0, 8);

  const places: RioRestaurant[] = ready.slice(0, 8).map((o) => {
    const kitchen = kitchenById.get(o.restaurant_id)!;
    return toRestaurant(kitchen, o.dish_name, o.is_veg, o.distance_km);
  });

  return {
    data: {
      query,
      offers: ready.slice(0, 8),
      unavailable_or_closed: soft,
      empty: ready.length === 0,
      instruction:
        ready.length > 0
          ? "Show these kitchens (cards attached). Customer picks ONE kitchen, then get_menu or cart add from that kitchen only. Mention open and ~km. Do not add dishes from two kitchens in one cart."
          : "No open in-range available matches. Use unavailable_or_closed to explain honestly, or browse_themes / different query.",
    },
    cards: places.length ? [{ kind: "restaurants", places }] : [],
    conflict: null,
  };
}

/** Re-check a named kitchen for a dish — honest available / closed / unavailable. */
export async function verifyDish(
  db: Db,
  args: {
    query?: unknown;
    restaurant_id?: unknown;
    restaurant_name?: unknown;
    delivery_lat?: unknown;
    delivery_lng?: unknown;
  },
): Promise<ToolOutcome> {
  const query = searchTerm(args.query);
  if (!query) {
    return {
      data: {
        error: "Need a dish name to verify.",
        instruction: "Ask which dish, then call verify_dish again.",
      },
      cards: [],
      conflict: null,
    };
  }

  const deliveryLat = typeof args.delivery_lat === "number" ? args.delivery_lat : null;
  const deliveryLng = typeof args.delivery_lng === "number" ? args.delivery_lng : null;

  let kitchen: Kitchen | null = null;
  if (isUuid(args.restaurant_id)) {
    const rows = await loadKitchens(db, [String(args.restaurant_id)]);
    kitchen = rows[0] ?? null;
  } else if (typeof args.restaurant_name === "string" && args.restaurant_name.trim()) {
    const name = searchTerm(args.restaurant_name);
    const { data, error } = await db
      .from("restaurant_browse")
      .select("id, name, cuisine, description, address, image_url, is_open, offer_percent, prep_minutes, lat, lng")
      .ilike("name", `%${name}%`)
      .limit(5);
    if (error) {
      return {
        data: { error: "Could not look up that kitchen.", instruction: "Ask for the restaurant name again." },
        cards: [],
        conflict: null,
      };
    }
    kitchen = ((data ?? []) as Kitchen[])[0] ?? null;
  }

  if (!kitchen) {
    return {
      data: {
        status: "not_on_menu",
        message: "Could not find that restaurant.",
        instruction: "Call find_offers for the dish without restaurant_id.",
      },
      cards: [],
      conflict: null,
    };
  }

  const distanceKm = kitchenDistanceKm(kitchen, deliveryLat, deliveryLng);
  const inRange = inDeliveryRange(kitchen, deliveryLat, deliveryLng);

  const { data: dishes, error } = await db
    .from("menu_items")
    .select("id, name, description, price, image_url, is_available, is_veg, category, restaurant_id")
    .eq("restaurant_id", kitchen.id)
    .or(`name.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(10);
  if (error) {
    return {
      data: { error: "Could not check that menu.", instruction: "Try find_offers instead." },
      cards: [],
      conflict: null,
    };
  }

  const matches = (dishes ?? []) as Dish[];
  if (matches.length === 0) {
    const alt = await findOffers(db, {
      query,
      delivery_lat: deliveryLat,
      delivery_lng: deliveryLng,
    });
    return {
      data: {
        status: "not_on_menu",
        restaurant_id: kitchen.id,
        restaurant_name: kitchen.name,
        is_open: kitchen.is_open,
        distance_km: distanceKm != null ? Number(distanceKm.toFixed(1)) : null,
        message: `${kitchen.name} does not list "${query}" on the menu right now.`,
        alternatives: alt.data,
        instruction: "Be honest. Offer alternatives from find_offers cards if any.",
      },
      cards: alt.cards,
      conflict: null,
    };
  }

  const available = matches.find((d) => d.is_available);
  const any = available ?? matches[0];

  let status: string = "available";
  if (!inRange) status = "out_of_range";
  else if (!kitchen.is_open) status = "closed";
  else if (!any.is_available) status = "unavailable";

  const place = toRestaurant(kitchen, any.name, any.is_veg, distanceKm);
  const cards: RioCard[] =
    status === "available" ? [{ kind: "restaurants", places: [place] }] : [];

  return {
    data: {
      status,
      restaurant_id: kitchen.id,
      restaurant_name: kitchen.name,
      is_open: kitchen.is_open,
      in_range: inRange,
      distance_km: distanceKm != null ? Number(distanceKm.toFixed(1)) : null,
      dish: {
        id: any.id,
        name: any.name,
        price: Number(any.price),
        is_available: any.is_available,
        is_veg: any.is_veg,
      },
      message:
        status === "available"
          ? `${kitchen.name} has ${any.name} available now.`
          : status === "unavailable"
          ? `Yes — ${kitchen.name} has ${any.name} on the menu, but it is not available right now.`
          : status === "closed"
          ? `Yes — ${kitchen.name} offers ${any.name}, but the kitchen is closed right now.`
          : `${kitchen.name} is outside the ${DELIVERY_MAX_KM} km delivery range from this address.`,
      instruction:
        status === "available"
          ? "Customer can get_menu or cart add this dish_id."
          : "Acknowledge they are right about the kitchen, explain the blocker, offer find_offers alternatives.",
    },
    cards,
    conflict: null,
  };
}

async function getMenuUncached(db: Db, args: { restaurant_id?: unknown }): Promise<ToolOutcome> {
  if (!isUuid(args.restaurant_id)) {
    return { data: { error: "A restaurant id is required." }, cards: [], conflict: null };
  }
  const [{ data: kitchen, error: kitchenError }, { data: rows, error }] = await Promise.all([
    db.from("restaurant_browse").select("id, name").eq("id", args.restaurant_id).maybeSingle(),
    db
      .from("menu_items")
      .select("id, restaurant_id, name, description, price, image_url, is_available, is_veg, category")
      .eq("restaurant_id", args.restaurant_id)
      .eq("is_available", true)
      .order("category")
      .order("name")
      .limit(10),
  ]);
  if (kitchenError || error) throw new Error(errText(kitchenError ?? error) || "Could not load menu.");
  if (!kitchen) return { data: { error: "Restaurant not found." }, cards: [], conflict: null };
  const items: RioMenuItem[] = ((rows ?? []) as Dish[]).map((row) => ({
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    imageUrl: row.image_url,
    isAvailable: row.is_available,
    isVeg: row.is_veg,
    category: row.category,
  }));
  return {
    data: {
      restaurant_id: kitchen.id,
      restaurant_name: kitchen.name,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        is_veg: item.isVeg,
        category: item.category,
      })),
    },
    cards: [{ kind: "menu", restaurantId: kitchen.id, restaurantName: kitchen.name, items: items.slice(0, 8) }],
    conflict: null,
  };
}

export async function getMenu(db: Db, args: { restaurant_id?: unknown }): Promise<ToolOutcome> {
  return cachedTool("get_menu", { restaurant_id: args.restaurant_id }, () => getMenuUncached(db, args));
}

type CartRow = {
  id: string;
  quantity: number;
  restaurant_id: string;
  menu_item_id: string;
  menu_items: { name: string; price: number; is_available: boolean } | { name: string; price: number; is_available: boolean }[] | null;
};

async function readCart(db: Db) {
  const { data, error } = await db
    .from("cart_items")
    .select("id, quantity, restaurant_id, menu_item_id, menu_items(name, price, is_available)")
    .order("created_at")
    .limit(10);
  if (error) throw new Error(errText(error) || "Could not load cart.");
  const rows = (data ?? []) as CartRow[];
  const restaurantId = rows[0]?.restaurant_id ?? null;
  let restaurantName = "Your cart";
  let offerPercent = 0;
  let kitchenLat: number | null = null;
  let kitchenLng: number | null = null;
  if (restaurantId) {
    const kitchens = await loadKitchens(db, [restaurantId]);
    const kitchen = kitchens[0];
    restaurantName = kitchen?.name ?? restaurantName;
    offerPercent = Math.max(0, Math.min(100, Number(kitchen?.offer_percent ?? 0)));
    kitchenLat = kitchen?.lat != null ? Number(kitchen.lat) : null;
    kitchenLng = kitchen?.lng != null ? Number(kitchen.lng) : null;
  }
  const lines = rows.map((row) => {
    const item = one(row.menu_items);
    return {
      name: item?.name ?? "Item",
      quantity: row.quantity,
      unitPrice: Number(item?.price ?? 0),
      menuItemId: row.menu_item_id,
    };
  });
  const subtotal = money(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const totals = cartTotals(subtotal, offerPercent, lines.length > 0);
  return {
    rows,
    restaurantId,
    restaurantName,
    kitchenLat,
    kitchenLng,
    lines,
    subtotal,
    offerPercent: totals.offerPercent,
    discountAmount: totals.discountAmount,
    discountedSubtotal: totals.discountedSubtotal,
    deliveryFee: totals.deliveryFee,
    total: totals.total,
  };
}

function cartPayload(cart: Awaited<ReturnType<typeof readCart>>, hash?: string) {
  return {
    restaurant_name: cart.lines.length ? cart.restaurantName : null,
    lines: cart.lines.map(({ name, quantity, unitPrice, menuItemId }) => ({
      name,
      quantity,
      unitPrice,
      menu_item_id: menuItemId,
    })),
    subtotal: cart.subtotal,
    offer_percent: cart.offerPercent,
    discount_amount: cart.discountAmount,
    delivery_fee: cart.deliveryFee,
    total: cart.total,
    ...(hash ? { cart_hash: hash } : {}),
  };
}

async function hashForCart(cart: Awaited<ReturnType<typeof readCart>>): Promise<string | null> {
  if (!cart.restaurantId || cart.lines.length === 0) return null;
  return cartHash({
    restaurantId: cart.restaurantId,
    lines: cart.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
    total: cart.total,
  });
}

async function cartCard(
  cart: Awaited<ReturnType<typeof readCart>>,
  confirm: boolean,
  needsAddress: boolean,
): Promise<RioCard> {
  const hash = confirm ? await hashForCart(cart) : null;
  return {
    kind: "cart",
    restaurantName: cart.restaurantName,
    lines: cart.lines.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice })),
    subtotal: cart.subtotal,
    offerPercent: cart.offerPercent,
    discountAmount: cart.discountAmount,
    deliveryFee: cart.deliveryFee,
    total: cart.total,
    confirm,
    needsAddress,
    ...(hash ? { cartHash: hash } : {}),
  };
}

export async function viewCart(db: Db): Promise<ToolOutcome> {
  const cart = await readCart(db);
  return {
    data: {
      empty: cart.lines.length === 0,
      ...cartPayload(cart),
    },
    cards: cart.lines.length ? [await cartCard(cart, false, false)] : [],
    conflict: null,
  };
}

async function menuItemForCart(db: Db, menuItemId: string) {
  const { data, error } = await db
    .from("menu_items")
    .select("id, name, restaurant_id, is_available")
    .eq("id", menuItemId)
    .maybeSingle();
  if (error) throw new Error(errText(error) || "Could not load that dish.");
  return data as { id: string; name: string; restaurant_id: string; is_available: boolean } | null;
}

export async function addToCart(
  db: Db,
  userId: string,
  menuItemId: string,
  deliveryLat: number | null = null,
  deliveryLng: number | null = null,
): Promise<ToolOutcome> {
  const item = await menuItemForCart(db, menuItemId);
  if (!item) {
    return { data: { error: "That dish could not be found." }, cards: [], conflict: null };
  }
  if (item.is_available !== true) {
    return {
      data: { error: "That dish is not available right now." },
      cards: [],
      conflict: null,
    };
  }

  const kitchensForItem = await loadKitchens(db, [item.restaurant_id]);
  const kitchen = kitchensForItem[0];
  const outOfRange = rangeError(deliveryLat, deliveryLng, {
    lat: kitchen?.lat,
    lng: kitchen?.lng,
    name: kitchen?.name,
  });
  if (outOfRange) {
    return { data: { error: "DELIVERY_RANGE", message: outOfRange }, cards: [], conflict: null };
  }

  const { data: existingCart, error: cartError } = await db
    .from("cart_items")
    .select("id, quantity, restaurant_id, menu_item_id")
    .limit(20);
  if (cartError) throw new Error(errText(cartError) || "Could not read cart.");
  const rows = (existingCart ?? []) as { id: string; quantity: number; restaurant_id: string; menu_item_id: string }[];
  const other = rows.find((row) => row.restaurant_id !== item.restaurant_id);
  if (other) {
    const kitchens = await loadKitchens(db, [other.restaurant_id]);
    const currentRestaurant = kitchens[0]?.name ?? "another restaurant";
    return {
      data: {
        error: "CART_OTHER_RESTAURANT",
        seller_choice: "two_orders",
        current_restaurant: currentRestaurant,
        wanted_item: item.name,
        wanted_restaurant: kitchen?.name ?? "another kitchen",
        message: `Your cart already has items from ${currentRestaurant}.`,
        instruction:
          "Do NOT call cart add again this turn. Explain one kitchen per order. Offer: (1) Keep current cart and checkout first, then order the other item as a second order, or (2) Clear cart and switch kitchen (customer taps Clear on the conflict UI).",
      },
      cards: [],
      conflict: { menuItemId: item.id, itemName: item.name, currentRestaurant },
    };
  }

  const same = rows.find((row) => row.menu_item_id === item.id);
  if (same) {
    const { error } = await db.from("cart_items").update({ quantity: same.quantity + 1 }).eq("id", same.id);
    if (error) throw new Error(errText(error) || "Could not update cart.");
  } else {
    const { error } = await db.from("cart_items").insert({
      customer_id: userId,
      menu_item_id: item.id,
      restaurant_id: item.restaurant_id,
      quantity: 1,
    });
    if (error && isOtherRestaurant(error)) {
      const { data: current } = await db.from("cart_items").select("restaurant_id").limit(1).maybeSingle();
      const currentKitchen = current ? await loadKitchens(db, [current.restaurant_id]) : [];
      const currentRestaurant = currentKitchen[0]?.name ?? "another restaurant";
      return {
        data: {
          error: "CART_OTHER_RESTAURANT",
          seller_choice: "two_orders",
          current_restaurant: currentRestaurant,
          wanted_item: item.name,
          instruction:
            "Do NOT call cart add again this turn. Explain one kitchen per order. Offer checkout-then-second-order or Clear & switch.",
        },
        cards: [],
        conflict: { menuItemId: item.id, itemName: item.name, currentRestaurant },
      };
    }
    if (error) throw new Error(errText(error) || "Could not add to cart.");
  }

  const cart = await readCart(db);
  return {
    data: { added: item.name, ...cartPayload(cart) },
    cards: [await cartCard(cart, false, false)],
    conflict: null,
  };
}

export async function updateCartQuantity(
  db: Db,
  args: { menu_item_id?: unknown; quantity?: unknown },
): Promise<ToolOutcome> {
  if (!isUuid(args.menu_item_id)) {
    return { data: { error: "A menu item id is required." }, cards: [], conflict: null };
  }
  const quantity = typeof args.quantity === "number" ? Math.floor(args.quantity) : NaN;
  if (!Number.isFinite(quantity) || quantity < 0) {
    return { data: { error: "quantity must be a non-negative number (0 removes the item)." }, cards: [], conflict: null };
  }

  const { data: row, error: findError } = await db
    .from("cart_items")
    .select("id, menu_item_id, quantity")
    .eq("menu_item_id", args.menu_item_id)
    .maybeSingle();
  if (findError) throw new Error(errText(findError) || "Could not read cart.");
  if (!row) {
    return { data: { error: "That dish is not in the cart." }, cards: [], conflict: null };
  }

  if (quantity < 1) {
    const { error } = await db.from("cart_items").delete().eq("id", row.id);
    if (error) throw new Error(errText(error) || "Could not remove from cart.");
  } else {
    const { error } = await db.from("cart_items").update({ quantity }).eq("id", row.id);
    if (error) throw new Error(errText(error) || "Could not update cart.");
  }

  const cart = await readCart(db);
  return {
    data: {
      updated: true,
      menu_item_id: args.menu_item_id,
      quantity,
      removed: quantity < 1,
      ...cartPayload(cart),
    },
    cards: cart.lines.length ? [await cartCard(cart, false, false)] : [],
    conflict: null,
  };
}

export async function replaceCart(
  db: Db,
  userId: string,
  menuItemId: string,
  deliveryLat: number | null = null,
  deliveryLng: number | null = null,
): Promise<ToolOutcome> {
  const item = await menuItemForCart(db, menuItemId);
  if (!item) {
    return { data: { error: "That dish could not be found." }, cards: [], conflict: null };
  }
  if (item.is_available !== true) {
    return {
      data: { error: "That dish is not available right now." },
      cards: [],
      conflict: null,
    };
  }
  const kitchensForItem = await loadKitchens(db, [item.restaurant_id]);
  const kitchen = kitchensForItem[0];
  const outOfRange = rangeError(deliveryLat, deliveryLng, {
    lat: kitchen?.lat,
    lng: kitchen?.lng,
    name: kitchen?.name,
  });
  if (outOfRange) {
    return { data: { error: "DELIVERY_RANGE", message: outOfRange }, cards: [], conflict: null };
  }
  const { error: clearError } = await db.from("cart_items").delete().eq("customer_id", userId);
  if (clearError) throw new Error(errText(clearError) || "Could not clear cart.");
  const { error } = await db.from("cart_items").insert({
    customer_id: userId,
    menu_item_id: item.id,
    restaurant_id: item.restaurant_id,
    quantity: 1,
  });
  if (error) throw new Error(errText(error) || "Could not add to cart.");
  const cart = await readCart(db);
  return {
    data: { replaced: true, added: item.name, ...cartPayload(cart) },
    cards: [await cartCard(cart, false, false)],
    conflict: null,
  };
}

export async function requestCheckout(
  db: Db,
  deliveryAddress: string | null,
  deliveryLat: number | null = null,
  deliveryLng: number | null = null,
): Promise<ToolOutcome> {
  const cart = await readCart(db);
  if (cart.lines.length === 0) {
    return { data: { error: "CART_EMPTY", message: "The cart is empty." }, cards: [], conflict: null };
  }
  const outOfRange = rangeError(deliveryLat, deliveryLng, {
    lat: cart.kitchenLat,
    lng: cart.kitchenLng,
    name: cart.restaurantName,
  });
  if (outOfRange) {
    return {
      data: { error: "DELIVERY_RANGE", message: outOfRange, ...cartPayload(cart) },
      cards: [await cartCard(cart, false, false)],
      conflict: null,
    };
  }
  const address = deliveryAddress?.trim() ?? "";
  const hash = await hashForCart(cart);
  if (!address) {
    return {
      data: {
        needs_address: true,
        ...cartPayload(cart, hash ?? undefined),
        message: "A saved delivery address is required before the order can be placed.",
      },
      cards: [await cartCard(cart, false, true)],
      conflict: null,
    };
  }
  return {
    data: {
      awaiting_confirmation: true,
      ...cartPayload(cart, hash ?? undefined),
      delivery_address: address,
      message:
        "Shown to the customer with a Confirm button. The order is not placed. Quote subtotal, discount, delivery fee, and total from this tool.",
    },
    cards: [await cartCard(cart, true, false)],
    conflict: null,
  };
}

export async function placeCustomerOrder(
  db: Db,
  deliveryAddress: string | null,
  deliveryAddressId: string | null,
  deliveryLat: number | null,
  deliveryLng: number | null,
  notes: string | null,
  expectedCartHash: string | null = null,
): Promise<ToolOutcome> {
  const address = deliveryAddress?.trim() ?? "";
  if (!address && !deliveryAddressId) {
    const cart = await readCart(db);
    return {
      data: { error: "A delivery address is required." },
      cards: cart.lines.length ? [await cartCard(cart, false, true)] : [],
      conflict: null,
    };
  }
  const cart = await readCart(db);
  if (cart.lines.length === 0) {
    return { data: { error: "CART_EMPTY", message: "The cart is empty." }, cards: [], conflict: null };
  }
  const liveHash = await hashForCart(cart);
  if (!expectedCartHash || !liveHash || expectedCartHash !== liveHash) {
    return {
      data: {
        error: "CART_CHANGED",
        message: "Your cart changed since you tapped Confirm. Open checkout again to place the order.",
      },
      cards: [await cartCard(cart, false, false)],
      conflict: null,
    };
  }
  const outOfRange = rangeError(deliveryLat, deliveryLng, {
    lat: cart.kitchenLat,
    lng: cart.kitchenLng,
    name: cart.restaurantName,
  });
  if (outOfRange) {
    return {
      data: { error: outOfRange },
      cards: [await cartCard(cart, false, false)],
      conflict: null,
    };
  }
  const { data, error } = await db.rpc("place_order", {
    p_delivery_address: address,
    ...(deliveryAddressId ? { p_delivery_address_id: deliveryAddressId } : {}),
    ...(deliveryLat != null ? { p_delivery_lat: deliveryLat } : {}),
    ...(deliveryLng != null ? { p_delivery_lng: deliveryLng } : {}),
    ...(notes?.trim() ? { p_notes: notes.trim() } : {}),
  });
  if (error || !data) {
    return { data: { error: errText(error) || "Could not place order." }, cards: [], conflict: null };
  }
  return trackOrder(db, { order_id: data });
}

export async function trackOrder(db: Db, args: { order_id?: unknown }): Promise<ToolOutcome> {
  let request = db
    .from("orders")
    .select("id, status, total_amount, delivery_fee, delivery_address, placed_at, restaurant_id, order_items(item_name, quantity)")
    .order("placed_at", { ascending: false })
    .limit(args.order_id ? 1 : 3);
  if (args.order_id != null) {
    if (!isUuid(args.order_id)) {
      return { data: { error: "That order id is not valid." }, cards: [], conflict: null };
    }
    request = request.eq("id", args.order_id);
  }
  const { data, error } = await request;
  if (error) throw new Error(errText(error) || "Could not load orders.");
  const rows = (data ?? []) as {
    id: string;
    status: string;
    total_amount: number;
    delivery_fee: number | null;
    delivery_address: string;
    placed_at: string;
    restaurant_id: string;
    order_items: { item_name: string; quantity: number }[] | null;
  }[];
  if (rows.length === 0) {
    return {
      data: { found: false, message: "No matching order is visible for this customer." },
      cards: [],
      conflict: null,
    };
  }
  const historyIds = rows.map((row) => row.id);
  const [kitchens, historyResult] = await Promise.all([
    loadKitchens(db, rows.map((row) => row.restaurant_id)),
    db
      .from("order_status_history")
      .select("order_id, status, changed_at")
      .in("order_id", historyIds)
      .order("changed_at", { ascending: false })
      .limit(Math.max(historyIds.length * 5, 5)),
  ]);
  if (historyResult.error) throw new Error(errText(historyResult.error) || "Could not load order status.");
  const byId = new Map(kitchens.map((kitchen) => [kitchen.id, kitchen]));
  const historyByOrder = new Map<string, { order_id: string; status: string; changed_at: string }[]>();
  for (const row of (historyResult.data ?? []) as { order_id: string; status: string; changed_at: string }[]) {
    const list = historyByOrder.get(row.order_id) ?? [];
    if (list.length >= 5) continue;
    list.push(row);
    historyByOrder.set(row.order_id, list);
  }
  const cards: RioCard[] = rows.map((row) => {
    const kitchen = byId.get(row.restaurant_id);
    const items = row.order_items ?? [];
    return {
      kind: "order",
      id: row.id,
      restaurantName: kitchen?.name ?? "Restaurant",
      imageUrl: kitchen?.image_url ?? null,
      status: row.status,
      total: Number(row.total_amount),
      placedAt: row.placed_at,
      itemsSummary: items.map((line) => `${line.quantity}× ${line.item_name}`).join(", ") || "Items from this kitchen",
      address: row.delivery_address,
    };
  });
  return {
    data: {
      found: true,
      orders: cards.map((card, index) => {
        if (card.kind !== "order") return card;
        const row = rows[index];
        return {
          id: card.id,
          status: card.status,
          restaurant_name: card.restaurantName,
          total: card.total,
          delivery_fee: row ? Number(row.delivery_fee ?? 0) : null,
          items: card.itemsSummary,
          history: (historyByOrder.get(card.id) ?? []).slice().reverse(),
        };
      }),
    },
    cards,
    conflict: null,
  };
}

/** Focused status + history for one order (RAG/support companion to track_order). */
export async function checkDeliveryStatus(db: Db, args: { order_id?: unknown }): Promise<ToolOutcome> {
  if (!isUuid(args.order_id)) {
    return { data: { error: "order_id is required." }, cards: [], conflict: null };
  }
  const outcome = await trackOrder(db, { order_id: args.order_id });
  if (!outcome.data.found) return outcome;
  const order = Array.isArray(outcome.data.orders) ? outcome.data.orders[0] : null;
  return {
    data: {
      found: true,
      order_id: args.order_id,
      status: order && typeof order === "object" ? (order as { status?: string }).status : null,
      history: order && typeof order === "object" ? (order as { history?: unknown }).history : [],
      summary: order,
    },
    cards: outcome.cards,
    conflict: null,
  };
}

async function resolveEscalateOrderId(db: Db, userId: string, orderId: unknown): Promise<string | null> {
  if (isUuid(orderId)) return orderId;
  const { data: active, error: activeError } = await db
    .from("orders")
    .select("id")
    .eq("customer_id", userId)
    .in("status", ACTIVE_ORDER_STATUSES)
    .order("placed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) throw new Error(errText(activeError) || "Could not load orders.");
  if (active?.id) return String(active.id);

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await db
    .from("orders")
    .select("id")
    .eq("customer_id", userId)
    .eq("status", "delivered")
    .gte("placed_at", since)
    .order("placed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentError) throw new Error(errText(recentError) || "Could not load orders.");
  return recent?.id ? String(recent.id) : null;
}

export async function escalateComplaint(
  db: Db,
  userId: string,
  args: { order_id?: unknown; issue_type?: unknown; description?: unknown },
): Promise<ToolOutcome> {
  const issueType = typeof args.issue_type === "string" ? args.issue_type.trim().slice(0, 80) : "";
  const description = typeof args.description === "string" ? args.description.trim().slice(0, 1000) : "";
  if (!issueType || !description) {
    return { data: { error: "issue_type and description are required." }, cards: [], conflict: null };
  }

  const orderId = await resolveEscalateOrderId(db, userId, args.order_id);
  if (!orderId) {
    return {
      data: {
        error: "NO_ORDER",
        message:
          "No recent order to attach a ticket to. Place an order first, or pass a specific order_id from track_order.",
      },
      cards: [],
      conflict: null,
    };
  }

  const { data: order, error: orderError } = await db
    .from("orders")
    .select("id, customer_id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw new Error(errText(orderError) || "Could not load order.");
  if (!order || order.customer_id !== userId) {
    return { data: { error: "That order is not visible for this customer." }, cards: [], conflict: null };
  }

  const urgency = ticketUrgency(issueType, description);
  const { data: ticket, error } = await db
    .from("support_tickets")
    .insert({
      order_id: orderId,
      customer_id: userId,
      issue_type: issueType,
      description,
      status: "open",
      urgency,
    })
    .select("id, order_id, issue_type, urgency, status, created_at")
    .single();
  if (error) throw new Error(errText(error) || "Could not open support ticket.");

  return {
    data: {
      ticket,
      order_id: orderId,
      message: `Opened a ${urgency}-urgency support ticket on order ${orderId}. Support will follow up.`,
    },
    cards: ticket
      ? [
          {
            kind: "ticket",
            id: String(ticket.id),
            orderId: String(ticket.order_id),
            issueType: String(ticket.issue_type),
            urgency: String(ticket.urgency),
            status: String(ticket.status),
          },
        ]
      : [],
    conflict: null,
  };
}

/** Re-add lines from the customer's latest delivered order (range-guarded). */
export async function reorderLast(
  db: Db,
  userId: string,
  deliveryLat: number | null = null,
  deliveryLng: number | null = null,
): Promise<ToolOutcome> {
  const { data: order, error } = await db
    .from("orders")
    .select("id, restaurant_id, order_items(menu_item_id, item_name, quantity)")
    .eq("customer_id", userId)
    .eq("status", "delivered")
    .order("placed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(errText(error) || "Could not load past orders.");
  if (!order) {
    return {
      data: { error: "NO_HISTORY", message: "No delivered orders to reorder yet." },
      cards: [],
      conflict: null,
    };
  }
  const kitchens = await loadKitchens(db, [order.restaurant_id]);
  const kitchen = kitchens[0];
  const outOfRange = rangeError(deliveryLat, deliveryLng, {
    lat: kitchen?.lat,
    lng: kitchen?.lng,
    name: kitchen?.name,
  });
  if (outOfRange) {
    return { data: { error: "DELIVERY_RANGE", message: outOfRange }, cards: [], conflict: null };
  }
  if (kitchen && kitchen.is_open === false) {
    return {
      data: { error: "RESTAURANT_CLOSED", message: `${kitchen.name} is closed right now.` },
      cards: [],
      conflict: null,
    };
  }

  const items = (order.order_items ?? []) as { menu_item_id: string | null; item_name: string; quantity: number }[];
  const usable = items.filter((row) => isUuid(row.menu_item_id));
  if (usable.length === 0) {
    return {
      data: { error: "NO_ITEMS", message: "That past order has no reorderable menu items." },
      cards: [],
      conflict: null,
    };
  }

  await db.from("cart_items").delete().eq("customer_id", userId);
  for (const row of usable.slice(0, 10)) {
    const { error: insertError } = await db.from("cart_items").insert({
      customer_id: userId,
      menu_item_id: row.menu_item_id,
      restaurant_id: order.restaurant_id,
      quantity: Math.max(1, Number(row.quantity) || 1),
    });
    if (insertError) throw new Error(errText(insertError) || "Could not rebuild cart.");
  }

  const cart = await readCart(db);
  return {
    data: {
      reordered: true,
      from_order_id: order.id,
      restaurant_name: kitchen?.name ?? cart.restaurantName,
      ...cartPayload(cart),
      message: "Cart rebuilt from your last delivered order. Call request_checkout when they are ready.",
    },
    cards: cart.lines.length ? [await cartCard(cart, false, false)] : [],
    conflict: null,
  };
}

async function retrieveContextUncached(
  db: Db,
  args: { query?: unknown; top_k?: unknown },
): Promise<ToolOutcome> {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) {
    return { data: { error: "query is required." }, cards: [], conflict: null };
  }
  const topK = typeof args.top_k === "number" && args.top_k > 0 ? Math.min(args.top_k, 12) : 8;

  try {
    const { retrieveContext } = await import("../_shared/embeddings.ts");
    // Public catalog + reviews only. Past-order questions use track_order / check_delivery_status (RLS).
    const chunks = await retrieveContext(db, query, Math.min(topK * 2, 20), [
      "menu_items",
      "ratings",
    ]);
    const filtered = chunks.filter((c) => {
      if (c.source_table !== "menu_items") return true;
      if (c.meta && typeof c.meta === "object" && "is_available" in c.meta) {
        return c.meta.is_available !== false;
      }
      return true;
    });

    // Diversify: prefer spreading restaurant_ids from meta when present.
    const perRestaurant = new Map<string, number>();
    const diversified = [];
    for (const chunk of filtered) {
      const restaurantId =
        chunk.meta && typeof chunk.meta === "object" && "restaurant_id" in chunk.meta
          ? String((chunk.meta as { restaurant_id?: unknown }).restaurant_id ?? "")
          : chunk.source_id;
      const count = perRestaurant.get(restaurantId) ?? 0;
      if (restaurantId && count >= 2) continue;
      if (restaurantId) perRestaurant.set(restaurantId, count + 1);
      diversified.push(chunk);
      if (diversified.length >= topK) break;
    }

    return {
      data: {
        grounded: true,
        query,
        count: diversified.length,
        results: diversified.map((c) => ({
          source_table: c.source_table,
          source_id: c.source_id,
          similarity: Number(c.similarity.toFixed(4)),
          preview: c.preview,
          meta: c.meta,
        })),
        instruction:
          diversified.length > 0
            ? "Only recommend dishes, prices, and review claims that appear in results. Spread picks across different restaurants when possible. Do not invent menu items."
            : "No RAG hits. Fall back to search_restaurants with a focused food query (not empty). Prefer search over loading a full menu. Do not invent dishes.",
      },
      cards: [],
      conflict: null,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "embeddings unavailable";
    return {
      data: {
        grounded: false,
        query,
        count: 0,
        results: [],
        error: detail.slice(0, 200),
        instruction:
          "RAG unavailable right now. Call search_restaurants with a focused query (limit 10). Avoid dumping a full get_menu. Do not invent dishes or prices.",
      },
      cards: [],
      conflict: null,
    };
  }
}

export async function retrieveContextTool(
  db: Db,
  args: { query?: unknown; top_k?: unknown },
): Promise<ToolOutcome> {
  const cacheArgs = {
    query: typeof args.query === "string" ? args.query.trim() : "",
    top_k: typeof args.top_k === "number" && args.top_k > 0 ? Math.min(args.top_k, 12) : 8,
  };
  return cachedTool("retrieve_context", cacheArgs, () => retrieveContextUncached(db, args));
}
