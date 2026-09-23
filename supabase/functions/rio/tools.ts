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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    .select("id, name, cuisine, description, address, image_url, is_open, offer_percent, prep_minutes")
    .in("id", unique);
  if (error) throw new Error(errText(error) || "Could not load restaurants.");
  return (data ?? []) as Kitchen[];
}

export async function searchRestaurants(
  db: Db,
  args: { query?: unknown; veg_only?: unknown; max_price?: unknown },
): Promise<ToolOutcome> {
  const query = searchTerm(args.query);
  const vegOnly = args.veg_only === true;
  const maxPrice = typeof args.max_price === "number" && args.max_price > 0 ? args.max_price : null;
  const broad = !query && !vegOnly && maxPrice == null;

  let kitchens: Kitchen[] = [];
  if (broad || query) {
    let request = db
      .from("restaurant_browse")
      .select("id, name, cuisine, description, address, image_url, is_open, offer_percent, prep_minutes")
      .order("is_open", { ascending: false })
      .order("name")
      .limit(12);
    if (query) {
      request = request.or(
        `name.ilike.%${query}%,cuisine.ilike.%${query}%,description.ilike.%${query}%`,
      );
    }
    const { data, error } = await request;
    if (error) throw new Error(errText(error) || "Could not search restaurants.");
    kitchens = (data ?? []) as Kitchen[];
  }

  let dishes: Dish[] = [];
  if (!broad) {
    let request = db
      .from("menu_items")
      .select("id, name, description, price, image_url, is_available, is_veg, category, restaurant_id")
      .order("name")
      .limit(24);
    if (query) {
      request = request.or(`name.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`);
    }
    if (vegOnly) request = request.eq("is_veg", true);
    if (maxPrice != null) request = request.lte("price", maxPrice);
    const { data, error } = await request;
    if (error) throw new Error(errText(error) || "Could not search dishes.");
    dishes = (data ?? []) as Dish[];
  }

  const known = new Set(kitchens.map((kitchen) => kitchen.id));
  const missing = dishes.map((dish) => dish.restaurant_id).filter((id) => !known.has(id));
  if (missing.length > 0) kitchens = [...kitchens, ...(await loadKitchens(db, missing))];

  const dishByRestaurant = new Map<string, Dish[]>();
  for (const dish of dishes) {
    const list = dishByRestaurant.get(dish.restaurant_id) ?? [];
    list.push(dish);
    dishByRestaurant.set(dish.restaurant_id, list);
  }

  const places = kitchens
    .map((kitchen) => {
      const matches = dishByRestaurant.get(kitchen.id) ?? [];
      const named = `${kitchen.name} ${kitchen.cuisine ?? ""} ${kitchen.description ?? ""}`.toLowerCase();
      const nameHit = query ? named.includes(query.toLowerCase()) : false;
      if (vegOnly && matches.length === 0) return null;
      if (maxPrice != null && matches.length === 0) return null;
      if (!broad && matches.length === 0 && !nameHit) return null;
      const featured = matches[0];
      const veg = matches.length > 0 ? matches.every((dish) => dish.is_veg) : false;
      return toRestaurant(kitchen, featured?.name ?? kitchen.cuisine?.trim() ?? "Menu", veg);
    })
    .filter((place): place is RioRestaurant => place != null)
    .sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || a.name.localeCompare(b.name))
    .slice(0, 6);

  return {
    data: {
      restaurants: places.map((place) => ({
        id: place.id,
        name: place.name,
        cuisine: place.cuisine,
        is_open: place.isOpen,
        sample_dish: place.dishName,
      })),
      dishes: dishes.slice(0, 8).map((dish) => ({
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

export async function getMenu(db: Db, args: { restaurant_id?: unknown }): Promise<ToolOutcome> {
  if (!isUuid(args.restaurant_id)) {
    return { data: { error: "A restaurant id is required." }, cards: [], conflict: null };
  }
  const [{ data: kitchen, error: kitchenError }, { data: rows, error }] = await Promise.all([
    db.from("restaurant_browse").select("id, name").eq("id", args.restaurant_id).maybeSingle(),
    db
      .from("menu_items")
      .select("id, restaurant_id, name, description, price, image_url, is_available, is_veg, category")
      .eq("restaurant_id", args.restaurant_id)
      .order("category")
      .order("name")
      .limit(30),
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
    .order("created_at");
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
    };
  });
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  return { rows, restaurantName, lines, total };
}

function cartCard(
  cart: Awaited<ReturnType<typeof readCart>>,
  confirm: boolean,
  needsAddress: boolean,
): RioCard {
  return {
    kind: "cart",
    restaurantName: cart.restaurantName,
    lines: cart.lines,
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
      restaurant_name: cart.lines.length ? cart.restaurantName : null,
      lines: cart.lines,
      total: cart.total,
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
  if (!item || item.is_available !== true) {
    return { data: { error: "That item is not available." }, cards: [], conflict: null };
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
    data: { added: item.name, restaurant_name: cart.restaurantName, lines: cart.lines, total: cart.total },
    cards: [cartCard(cart, false, false)],
    conflict: null,
  };
}

export async function replaceCart(db: Db, userId: string, menuItemId: string): Promise<ToolOutcome> {
  const item = await menuItemForCart(db, menuItemId);
  if (!item || item.is_available !== true) {
    return { data: { error: "That item is not available." }, cards: [], conflict: null };
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
    data: { replaced: true, added: item.name, lines: cart.lines, total: cart.total },
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
        restaurant_name: cart.restaurantName,
        lines: cart.lines,
        total: cart.total,
        message: "A saved delivery address is required before the order can be placed.",
      },
      cards: [cartCard(cart, false, true)],
      conflict: null,
    };
  }
  return {
    data: {
      awaiting_confirmation: true,
      restaurant_name: cart.restaurantName,
      lines: cart.lines,
      total: cart.total,
      delivery_address: address,
      message: "Shown to the customer with a Confirm button. The order is not placed.",
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
    .select("id, status, total_amount, delivery_address, placed_at, restaurant_id, order_items(item_name, quantity)")
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
  const kitchens = await loadKitchens(db, rows.map((row) => row.restaurant_id));
  const byId = new Map(kitchens.map((kitchen) => [kitchen.id, kitchen]));
  const historyIds = rows.map((row) => row.id);
  const { data: history, error: historyError } = await db
    .from("order_status_history")
    .select("order_id, status, changed_at")
    .in("order_id", historyIds)
    .order("changed_at");
  if (historyError) throw new Error(errText(historyError) || "Could not load order status.");
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
      orders: cards.map((card) => {
        if (card.kind !== "order") return card;
        return {
          id: card.id,
          status: card.status,
          restaurant_name: card.restaurantName,
          total: card.total,
          items: card.itemsSummary,
          history: ((history ?? []) as { order_id: string; status: string; changed_at: string }[]).filter((entry) => entry.order_id === card.id),
        };
      }),
    },
    cards,
    conflict: null,
  };
}
