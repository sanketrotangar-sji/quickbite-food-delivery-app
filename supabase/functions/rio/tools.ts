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
    total: number;
    confirm: boolean;
    needsAddress: boolean;
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

/** Must match public.standard_delivery_fee() (₹40). */
export const STANDARD_DELIVERY_FEE = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLOSED_QUERY = /\b(closed|shut|offline|not open)\b/i;

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

function toRestaurant(kitchen: Kitchen, dishName: string, veg: boolean): RioRestaurant {
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
  };
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

  const kitchenPromise = (async () => {
    if (!(broad || query)) return [] as Kitchen[];
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
    if (broad) return [] as Dish[];
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
      if (!broad && matches.length === 0 && !nameHit) return null;
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
    .sort((a, b) => {
      const openDelta = Number(b.place.isOpen) - Number(a.place.isOpen);
      if (openDelta !== 0) return openDelta;
      if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      if (b.offer !== a.offer) return b.offer - a.offer;
      return a.place.name.localeCompare(b.place.name);
    });

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
  if (restaurantId) {
    const kitchens = await loadKitchens(db, [restaurantId]);
    restaurantName = kitchens[0]?.name ?? restaurantName;
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
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const deliveryFee = lines.length > 0 ? STANDARD_DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;
  return { rows, restaurantName, lines, subtotal, deliveryFee, total };
}

function cartPayload(cart: Awaited<ReturnType<typeof readCart>>) {
  return {
    restaurant_name: cart.lines.length ? cart.restaurantName : null,
    lines: cart.lines.map(({ name, quantity, unitPrice, menuItemId }) => ({
      name,
      quantity,
      unitPrice,
      menu_item_id: menuItemId,
    })),
    subtotal: cart.subtotal,
    delivery_fee: cart.deliveryFee,
    total: cart.total,
  };
}

function cartCard(
  cart: Awaited<ReturnType<typeof readCart>>,
  confirm: boolean,
  needsAddress: boolean,
): RioCard {
  return {
    kind: "cart",
    restaurantName: cart.restaurantName,
    lines: cart.lines.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice })),
    total: cart.total,
    confirm,
    needsAddress,
  };
}

export async function viewCart(db: Db): Promise<ToolOutcome> {
  const cart = await readCart(db);
  return {
    data: {
      empty: cart.lines.length === 0,
      ...cartPayload(cart),
    },
    cards: cart.lines.length ? [cartCard(cart, false, false)] : [],
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

export async function addToCart(db: Db, userId: string, menuItemId: string): Promise<ToolOutcome> {
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
        current_restaurant: currentRestaurant,
        message: `Your cart already has items from ${currentRestaurant}.`,
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
        data: { error: "CART_OTHER_RESTAURANT", current_restaurant: currentRestaurant },
        cards: [],
        conflict: { menuItemId: item.id, itemName: item.name, currentRestaurant },
      };
    }
    if (error) throw new Error(errText(error) || "Could not add to cart.");
  }

  const cart = await readCart(db);
  return {
    data: { added: item.name, ...cartPayload(cart) },
    cards: [cartCard(cart, false, false)],
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
    cards: cart.lines.length ? [cartCard(cart, false, false)] : [],
    conflict: null,
  };
}

export async function replaceCart(db: Db, userId: string, menuItemId: string): Promise<ToolOutcome> {
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
    cards: [cartCard(cart, false, false)],
    conflict: null,
  };
}

export async function requestCheckout(db: Db, deliveryAddress: string | null): Promise<ToolOutcome> {
  const cart = await readCart(db);
  if (cart.lines.length === 0) {
    return { data: { error: "CART_EMPTY", message: "The cart is empty." }, cards: [], conflict: null };
  }
  const address = deliveryAddress?.trim() ?? "";
  if (!address) {
    return {
      data: {
        needs_address: true,
        ...cartPayload(cart),
        message: "A saved delivery address is required before the order can be placed.",
      },
      cards: [cartCard(cart, false, true)],
      conflict: null,
    };
  }
  return {
    data: {
      awaiting_confirmation: true,
      ...cartPayload(cart),
      delivery_address: address,
      message: "Shown to the customer with a Confirm button. The order is not placed. Total includes delivery fee.",
    },
    cards: [cartCard(cart, true, false)],
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
): Promise<ToolOutcome> {
  const address = deliveryAddress?.trim() ?? "";
  if (!address && !deliveryAddressId) {
    const cart = await readCart(db);
    return {
      data: { error: "A delivery address is required." },
      cards: cart.lines.length ? [cartCard(cart, false, true)] : [],
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

export async function escalateComplaint(
  db: Db,
  userId: string,
  args: { order_id?: unknown; issue_type?: unknown; description?: unknown },
): Promise<ToolOutcome> {
  if (!isUuid(args.order_id)) {
    return { data: { error: "order_id is required." }, cards: [], conflict: null };
  }
  const issueType = typeof args.issue_type === "string" ? args.issue_type.trim().slice(0, 80) : "";
  const description = typeof args.description === "string" ? args.description.trim().slice(0, 1000) : "";
  if (!issueType || !description) {
    return { data: { error: "issue_type and description are required." }, cards: [], conflict: null };
  }

  const { data: order, error: orderError } = await db
    .from("orders")
    .select("id, customer_id, status")
    .eq("id", args.order_id)
    .maybeSingle();
  if (orderError) throw new Error(errText(orderError) || "Could not load order.");
  if (!order || order.customer_id !== userId) {
    return { data: { error: "That order is not visible for this customer." }, cards: [], conflict: null };
  }

  const urgency = ticketUrgency(issueType, description);
  const { data: ticket, error } = await db
    .from("support_tickets")
    .insert({
      order_id: args.order_id,
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
      message: `Opened a ${urgency}-urgency support ticket. Support will follow up.`,
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
    const chunks = await retrieveContext(db, query, Math.min(topK * 2, 20), ["menu_items", "ratings"]);
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
