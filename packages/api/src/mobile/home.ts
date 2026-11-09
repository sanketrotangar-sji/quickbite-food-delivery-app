import {
  categorySlug,
  POPULAR_CATEGORY_ID,
  type HomeCategory,
  type HomeDish,
  type HomeHighlight,
  type HomePlace,
} from '../homeCatalog';
import type { MenuItem, RestaurantBrowse } from '../models';

import { db } from '../supabase';
import { throwApiError } from '../errors';

type RatingRow = {
  restaurant_id: string;
  food_rating: number;
};

type RatingSummaryRow = {
  restaurant_id: string;
  avg_food: number;
  rating_count: number;
};

export type HomeCatalog = {
  categories: HomeCategory[];
  dishes: HomeDish[];
  places: HomePlace[];
  highlights: HomeHighlight[];
};

function averageRatings(rows: RatingRow[]) {
  const sums = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const current = sums.get(row.restaurant_id) ?? { total: 0, count: 0 };
    current.total += row.food_rating;
    current.count += 1;
    sums.set(row.restaurant_id, current);
  }
  const averages = new Map<string, number>();
  for (const [id, value] of sums) {
    averages.set(id, value.total / value.count);
  }
  return averages;
}

function ratingMapFromSummary(rows: RatingSummaryRow[]) {
  const averages = new Map<string, number>();
  for (const row of rows) {
    if (row.rating_count > 0) averages.set(row.restaurant_id, Number(row.avg_food));
  }
  return averages;
}

async function loadRatingAverages(restaurantIds: string[]) {
  if (restaurantIds.length === 0) return new Map<string, number>();
  // View may lag generated types — cast until types:gen catches up.
  const summary = await (db() as any)
    .from('restaurant_rating_summary')
    .select('restaurant_id, avg_food, rating_count')
    .in('restaurant_id', restaurantIds);
  if (!summary.error && summary.data) {
    return ratingMapFromSummary(summary.data as unknown as RatingSummaryRow[]);
  }
  // View not migrated yet — fall back to scoped public rows.
  const ratings = await db()
    .from('restaurant_rating_public')
    .select('restaurant_id, food_rating')
    .in('restaurant_id', restaurantIds);
  if (ratings.error) throwApiError(ratings.error, 'Could not load ratings.');
  return averageRatings((ratings.data ?? []) as RatingRow[]);
}

/** Prefer one dish per kitchen first, then a second pass — avoids alphabetical mono-food rails. */
export function diversifyMenuItems(items: MenuItem[], maxPerRestaurant = 2, maxTotal = 48): MenuItem[] {
  const byKitchen = new Map<string, MenuItem[]>();
  for (const item of items) {
    const list = byKitchen.get(item.restaurant_id) ?? [];
    list.push(item);
    byKitchen.set(item.restaurant_id, list);
  }

  for (const [id, list] of byKitchen) {
    const seenCategories = new Set<string>();
    const diversified: MenuItem[] = [];
    for (const item of list) {
      const cat = (item.category ?? '').trim().toLowerCase() || 'other';
      if (seenCategories.has(cat) && diversified.length > 0) continue;
      seenCategories.add(cat);
      diversified.push(item);
      if (diversified.length >= maxPerRestaurant) break;
    }
    if (diversified.length < maxPerRestaurant) {
      for (const item of list) {
        if (diversified.includes(item)) continue;
        diversified.push(item);
        if (diversified.length >= maxPerRestaurant) break;
      }
    }
    byKitchen.set(id, diversified);
  }

  const picked: MenuItem[] = [];
  const queues = [...byKitchen.values()];
  let index = 0;
  while (picked.length < maxTotal && queues.some((q) => q.length > 0)) {
    const queue = queues[index % queues.length];
    if (queue && queue.length > 0) {
      const next = queue.shift();
      if (next) picked.push(next);
    }
    index += 1;
    if (index > queues.length * maxPerRestaurant + maxTotal) break;
  }
  return picked;
}

function pickFeaturedDish(kitchenDishes: HomeDish[], usedNames: Set<string>) {
  const unique = kitchenDishes.find((dish) => !usedNames.has(dish.name.toLowerCase()));
  const featured = unique ?? kitchenDishes[0];
  if (featured) usedNames.add(featured.name.toLowerCase());
  return featured;
}

export function buildHomeCatalog(
  restaurants: RestaurantBrowse[],
  menuItems: MenuItem[],
  ratingByRestaurant: Map<string, number>,
): Omit<HomeCatalog, 'highlights'> {
  const restaurantById = new Map(restaurants.map((row) => [row.id, row]));
  const available = diversifyMenuItems(
    menuItems.filter((item) => item.is_available),
    2,
    48,
  );

  const dishes: HomeDish[] = available.map((item) => {
    const kitchen = restaurantById.get(item.restaurant_id);
    return {
      id: item.id,
      name: item.name,
      restaurantName: kitchen?.name ?? 'Kitchen',
      restaurantId: item.restaurant_id,
      category: item.category?.trim() || 'Mains',
      price: Number(item.price),
      imageUrl: item.image_url ?? '',
      veg: Boolean(item.is_veg),
    };
  });

  const dishesByRestaurant = new Map<string, HomeDish[]>();
  for (const dish of dishes) {
    const list = dishesByRestaurant.get(dish.restaurantId) ?? [];
    list.push(dish);
    dishesByRestaurant.set(dish.restaurantId, list);
  }

  const categoryMap = new Map<string, HomeCategory>();
  for (const dish of dishes) {
    const id = categorySlug(dish.category);
    if (!id || id === POPULAR_CATEGORY_ID) continue;
    if (categoryMap.has(id)) continue;
    categoryMap.set(id, {
      id,
      label: dish.category,
      imageUrl: dish.imageUrl,
    });
  }

  const popularImage =
    dishes.find((dish) => dish.imageUrl)?.imageUrl ||
    restaurants.find((row) => row.image_url)?.image_url ||
    '';

  const categories: HomeCategory[] = [
    { id: POPULAR_CATEGORY_ID, label: 'Popular', imageUrl: popularImage },
    ...categoryMap.values(),
  ];

  const usedFeaturedNames = new Set<string>();
  const places: HomePlace[] = restaurants.map((kitchen) => {
    const kitchenDishes = dishesByRestaurant.get(kitchen.id) ?? [];
    const featured = pickFeaturedDish(kitchenDishes, usedFeaturedNames);
    const categoryIds = [...new Set(kitchenDishes.map((dish) => categorySlug(dish.category)))];
    return {
      id: kitchen.id,
      name: kitchen.name,
      cuisine: kitchen.cuisine?.trim() || 'Multi-cuisine',
      dishName: featured?.name ?? kitchen.cuisine?.trim() ?? 'Menu coming soon',
      rating: ratingByRestaurant.get(kitchen.id) ?? null,
      imageUrl: kitchen.image_url || featured?.imageUrl || '',
      address: kitchen.address,
      isOpen: kitchen.is_open,
      veg: kitchenDishes.length > 0 && kitchenDishes.every((dish) => dish.veg),
      hasNonVeg: kitchenDishes.some((dish) => !dish.veg),
      categoryIds,
      offerPercent: kitchen.offer_percent,
      prepMinutes: kitchen.prep_minutes,
      lat: kitchen.lat ?? null,
      lng: kitchen.lng ?? null,
      distanceKm: null,
    };
  });

  return { categories, dishes, places };
}

function buildShellPlaces(
  restaurants: RestaurantBrowse[],
  ratingByRestaurant: Map<string, number>,
): HomePlace[] {
  return restaurants.map((kitchen) => ({
    id: kitchen.id,
    name: kitchen.name,
    cuisine: kitchen.cuisine?.trim() || 'Multi-cuisine',
    dishName: kitchen.cuisine?.trim() || 'Menu coming soon',
    rating: ratingByRestaurant.get(kitchen.id) ?? null,
    imageUrl: kitchen.image_url || '',
    address: kitchen.address,
    isOpen: kitchen.is_open,
    veg: false,
    hasNonVeg: false,
    categoryIds: [],
    offerPercent: kitchen.offer_percent,
    prepMinutes: kitchen.prep_minutes,
    lat: kitchen.lat ?? null,
    lng: kitchen.lng ?? null,
    distanceKm: null,
  }));
}

/** Favorites by heart ids — no full catalog. */
export async function fetchFavoritesCatalog(ids: string[]): Promise<{
  places: HomePlace[];
  dishes: HomeDish[];
}> {
  const unique = [...new Set(ids)].slice(0, 80);
  if (unique.length === 0) return { places: [], dishes: [] };

  const [restaurants, menuItems] = await Promise.all([
    db()
      .from('restaurant_browse')
      .select(
        'id, name, cuisine, description, image_url, is_open, offer_percent, prep_minutes, address, lat, lng, branch_name',
      )
      .in('id', unique),
    db()
      .from('menu_items')
      .select('id, restaurant_id, name, price, image_url, is_available, is_veg, category')
      .in('id', unique)
      .eq('is_available', true),
  ]);
  if (restaurants.error) throwApiError(restaurants.error, 'Could not load favorites.');
  if (menuItems.error) throwApiError(menuItems.error, 'Could not load favorites.');

  const kitchenRows = (restaurants.data ?? []) as RestaurantBrowse[];
  const dishRows = (menuItems.data ?? []) as MenuItem[];
  const ratingByRestaurant = await loadRatingAverages([
    ...kitchenRows.map((row) => row.id),
    ...dishRows.map((row) => row.restaurant_id),
  ]);

  const missingKitchenIds = dishRows
    .map((row) => row.restaurant_id)
    .filter((id) => !kitchenRows.some((row) => row.id === id));
  let extraKitchens: RestaurantBrowse[] = [];
  if (missingKitchenIds.length > 0) {
    const extra = await db()
      .from('restaurant_browse')
      .select(
        'id, name, cuisine, description, image_url, is_open, offer_percent, prep_minutes, address, lat, lng, branch_name',
      )
      .in('id', [...new Set(missingKitchenIds)]);
    if (!extra.error) extraKitchens = (extra.data ?? []) as RestaurantBrowse[];
  }

  const catalog = buildHomeCatalog(
    [...kitchenRows, ...extraKitchens],
    dishRows,
    ratingByRestaurant,
  );
  const placeIds = new Set(kitchenRows.map((row) => row.id));
  const dishIds = new Set(dishRows.map((row) => row.id));
  return {
    places: catalog.places.filter((place) => placeIds.has(place.id)),
    dishes: catalog.dishes.filter((dish) => dishIds.has(dish.id)),
  };
}

/** Similar kitchens for restaurant detail — small query, not full catalog. */
export async function fetchSimilarPlaces(
  restaurantId: string,
  cuisine: string | null | undefined,
  limit = 6,
): Promise<HomePlace[]> {
  let query = db()
    .from('restaurant_browse')
    .select(
      'id, name, cuisine, description, image_url, is_open, offer_percent, prep_minutes, address, lat, lng, branch_name',
    )
    .neq('id', restaurantId)
    .order('is_open', { ascending: false })
    .limit(24);
  if (cuisine?.trim()) {
    query = query.ilike('cuisine', `%${cuisine.trim()}%`);
  }
  const { data, error } = await query;
  if (error) throwApiError(error, 'Could not load similar kitchens.');
  let rows = (data ?? []) as RestaurantBrowse[];
  if (rows.length < limit) {
    const fill = await db()
      .from('restaurant_browse')
      .select(
        'id, name, cuisine, description, image_url, is_open, offer_percent, prep_minutes, address, lat, lng, branch_name',
      )
      .neq('id', restaurantId)
      .order('is_open', { ascending: false })
      .limit(limit);
    if (!fill.error) {
      const seen = new Set(rows.map((row) => row.id));
      for (const row of (fill.data ?? []) as RestaurantBrowse[]) {
        if (seen.has(row.id)) continue;
        rows.push(row);
        if (rows.length >= limit) break;
      }
    }
  }
  rows = rows.slice(0, limit);
  const ratingByRestaurant = await loadRatingAverages(rows.map((row) => row.id));
  return buildShellPlaces(rows, ratingByRestaurant);
}
