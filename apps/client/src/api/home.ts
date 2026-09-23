import {
  categorySlug,
  POPULAR_CATEGORY_ID,
  type HomeCategory,
  type HomeDish,
  type HomeHighlight,
  type HomePlace,
} from '@/lib/home-mock';
import type { MenuItem, RestaurantBrowse } from '@/types/models';

import { supabase } from './supabaseClient';
import { throwApiError } from './errors';

type HighlightRow = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  kind: 'offer' | 'video';
  restaurant_id?: string | null;
  badge?: string | null;
  cta_label?: string | null;
  restaurants?: { name: string } | { name: string }[] | null;
};

type RatingRow = {
  restaurant_id: string;
  food_rating: number;
};

export type HomeCatalog = {
  categories: HomeCategory[];
  dishes: HomeDish[];
  places: HomePlace[];
  highlights: HomeHighlight[];
};

function restaurantNameFromHighlight(
  row: HighlightRow,
  restaurantById: Map<string, RestaurantBrowse>,
) {
  const joined = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;
  if (joined?.name) return joined.name;
  if (row.restaurant_id) return restaurantById.get(row.restaurant_id)?.name ?? '';
  return '';
}

async function fetchHighlights(): Promise<HighlightRow[]> {
  const full = await supabase
    .from('home_highlights')
    .select('id, title, subtitle, image_url, kind, restaurant_id, badge, cta_label, restaurants(name)')
    .eq('is_active', true)
    .order('sort_order');
  if (!full.error) return (full.data ?? []) as HighlightRow[];

  // Migration not applied yet — keep kitchens loading without offer links.
  const basic = await supabase
    .from('home_highlights')
    .select('id, title, subtitle, image_url, kind')
    .eq('is_active', true)
    .order('sort_order');
  if (basic.error) return [];
  return (basic.data ?? []).map((row) => ({
    ...row,
    restaurant_id: null,
    badge: null,
    cta_label: null,
    restaurants: null,
  }));
}

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

export function buildHomeCatalog(
  restaurants: RestaurantBrowse[],
  menuItems: MenuItem[],
  ratings: RatingRow[],
  highlights: HighlightRow[],
): HomeCatalog {
  const restaurantById = new Map(restaurants.map((row) => [row.id, row]));
  const ratingByRestaurant = averageRatings(ratings);
  const available = menuItems.filter((item) => item.is_available);

  const dishes: HomeDish[] = available.map((item) => {
    const kitchen = restaurantById.get(item.restaurant_id);
    return {
      id: item.id,
      name: item.name,
      restaurantName: kitchen?.name ?? 'Kitchen',
      restaurantId: item.restaurant_id,
      category: item.category?.trim() || 'Popular',
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

  const places: HomePlace[] = restaurants.map((kitchen) => {
    const kitchenDishes = dishesByRestaurant.get(kitchen.id) ?? [];
    const featured = kitchenDishes[0];
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
    };
  });

  return {
    categories,
    dishes,
    places,
    highlights: highlights.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle ?? '',
      imageUrl: row.image_url,
      kind: row.kind,
      restaurantId: row.restaurant_id ?? null,
      restaurantName: restaurantNameFromHighlight(row, restaurantById),
      badge: row.badge?.trim() || (row.kind === 'offer' ? 'Offer' : 'Watch'),
      ctaLabel: row.cta_label?.trim() || 'Order Now',
    })),
  };
}

export async function fetchHomeCatalog(): Promise<HomeCatalog> {
  const [restaurants, menuItems, ratings, highlights, mine] = await Promise.all([
    supabase.from('restaurant_browse').select('*').order('is_open', { ascending: false }).order('name'),
    supabase.from('menu_items').select('*').eq('is_available', true).order('name'),
    supabase.from('restaurant_rating_public').select('restaurant_id, food_rating'),
    fetchHighlights(),
    supabase.rpc('list_my_restaurants'),
  ]);

  if (restaurants.error) throwApiError(restaurants.error, 'Could not load restaurants.');
  if (menuItems.error) throwApiError(menuItems.error, 'Could not load dishes.');
  if (ratings.error) throwApiError(ratings.error, 'Could not load ratings.');

  const hidden = new Set((mine.error ? [] : mine.data ?? []).map((row) => row.id));
  const visibleRestaurants = (restaurants.data ?? []).filter((row) => !hidden.has(row.id));
  const visibleItems = (menuItems.data ?? []).filter((item) => !hidden.has(item.restaurant_id));

  return buildHomeCatalog(visibleRestaurants, visibleItems, ratings.data ?? [], highlights);
}
