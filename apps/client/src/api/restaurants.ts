import type { MenuItem, Restaurant, RestaurantBrowse } from '@/types/models';

import { supabase } from './supabaseClient';
import { throwApiError } from './errors';

export async function listMyRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase.rpc('list_my_restaurants');
  if (error) throwApiError(error, 'Could not load your restaurants.');
  return data ?? [];
}

export async function listRestaurants(): Promise<RestaurantBrowse[]> {
  const [all, mine] = await Promise.all([
    supabase.from('restaurant_browse').select('*').order('is_open', { ascending: false }).order('name'),
    supabase.rpc('list_my_restaurants'),
  ]);
  if (all.error) throwApiError(all.error, 'Could not load restaurants.');
  const hidden = new Set((mine.error ? [] : mine.data ?? []).map((row) => row.id));
  return (all.data ?? []).filter((row) => !hidden.has(row.id));
}

export async function getRestaurant(id: string): Promise<RestaurantBrowse> {
  const { data, error } = await supabase.from('restaurant_browse').select('*').eq('id', id).single();
  if (error || !data) throwApiError(error ?? {}, 'Restaurant not found.');
  return data;
}

export async function listRestaurantRatings(restaurantId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('restaurant_rating_public')
    .select('food_rating')
    .eq('restaurant_id', restaurantId);
  if (error) throwApiError(error, 'Could not load ratings.');
  return (data ?? []).map((row) => Number(row.food_rating)).filter((value) => !Number.isNaN(value));
}

export async function listMenuItems(restaurantId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('name');
  if (error) throwApiError(error, 'Could not load menu.');
  return data ?? [];
}
