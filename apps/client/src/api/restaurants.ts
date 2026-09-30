import type { MenuItem, Restaurant, RestaurantBrowse } from '@/types/models';

import { supabase } from './supabaseClient';
import { throwApiError } from './errors';

const BROWSE_COLUMNS =
  'id, name, cuisine, description, image_url, is_open, offer_percent, prep_minutes, address, lat, lng, branch_name';

const MENU_COLUMNS =
  'id, restaurant_id, name, description, price, image_url, is_available, is_veg, category';

export async function listMyRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase.rpc('list_my_restaurants');
  if (error) throwApiError(error, 'Could not load your restaurants.');
  return data ?? [];
}

export async function listRestaurants(): Promise<RestaurantBrowse[]> {
  const [all, mine] = await Promise.all([
    supabase
      .from('restaurant_browse')
      .select(BROWSE_COLUMNS)
      .order('is_open', { ascending: false })
      .order('name')
      .limit(80),
    supabase.rpc('list_my_restaurants'),
  ]);
  if (all.error) throwApiError(all.error, 'Could not load restaurants.');
  const hidden = new Set((mine.error ? [] : mine.data ?? []).map((row) => row.id));
  return (all.data ?? []).filter((row) => !hidden.has(row.id)) as RestaurantBrowse[];
}

export async function getRestaurant(id: string): Promise<RestaurantBrowse> {
  const { data, error } = await supabase.from('restaurant_browse').select(BROWSE_COLUMNS).eq('id', id).single();
  if (error || !data) throwApiError(error ?? {}, 'Restaurant not found.');
  return data as RestaurantBrowse;
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
    .select(MENU_COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('name');
  if (error) throwApiError(error, 'Could not load menu.');
  return (data ?? []) as MenuItem[];
}
