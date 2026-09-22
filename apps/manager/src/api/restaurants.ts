import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

import { throwApiError } from './errors';

export type Restaurant = Database['public']['Tables']['restaurants']['Row'];

export type RestaurantPatch = {
  name?: string;
  cuisine?: string | null;
  address?: string;
  phone?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_open?: boolean;
};

export async function listMyRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase.rpc('list_my_restaurants');
  if (error) throwApiError(error, 'Could not load restaurants.');
  return Array.isArray(data) ? data : [];
}

export async function getOwnedRestaurant(ownerId: string): Promise<Restaurant | null> {
  const restaurants = await listMyRestaurants();
  return restaurants.find((row) => row.owner_id === ownerId) ?? restaurants[0] ?? null;
}

export async function updateOwnedRestaurant(id: string, patch: RestaurantPatch): Promise<Restaurant> {
  const { data, error } = await supabase.from('restaurants').update(patch).eq('id', id).select('*').single();
  if (error || !data) throwApiError(error ?? {}, 'Could not update restaurant.');
  return data;
}

export type RatingSummary = { average: number; count: number };

export async function listRatingSummaries(restaurantIds: string[]): Promise<Record<string, RatingSummary>> {
  const summaries: Record<string, RatingSummary> = {};
  for (const id of restaurantIds) summaries[id] = { average: 0, count: 0 };
  if (restaurantIds.length === 0) return summaries;

  const { data, error } = await supabase
    .from('ratings')
    .select('restaurant_id, food_rating')
    .in('restaurant_id', restaurantIds);
  if (error) throwApiError(error, 'Could not load ratings.');

  const buckets = new Map<string, number[]>();
  for (const row of data ?? []) {
    const scores = buckets.get(row.restaurant_id) ?? [];
    scores.push(row.food_rating);
    buckets.set(row.restaurant_id, scores);
  }
  for (const [id, scores] of buckets) {
    summaries[id] = {
      average: scores.reduce((total, score) => total + score, 0) / scores.length,
      count: scores.length,
    };
  }
  return summaries;
}

export async function getRestaurantRatingSummary(restaurantId: string): Promise<RatingSummary> {
  const { data, error } = await supabase.from('ratings').select('food_rating').eq('restaurant_id', restaurantId);
  if (error) throwApiError(error, 'Could not load ratings.');
  const rows = data ?? [];
  if (rows.length === 0) return { average: 0, count: 0 };
  const sum = rows.reduce((total, row) => total + row.food_rating, 0);
  return { average: sum / rows.length, count: rows.length };
}
