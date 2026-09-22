import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

import { throwApiError } from './errors';

export type DbMenuItem = Database['public']['Tables']['menu_items']['Row'];

export async function listMenuItems(restaurantId: string): Promise<DbMenuItem[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('name');
  if (error) throwApiError(error, 'Could not load menu.');
  return data ?? [];
}

export async function setMenuItemAvailability(id: string, isAvailable: boolean): Promise<void> {
  const { error } = await supabase.from('menu_items').update({ is_available: isAvailable }).eq('id', id);
  if (error) throwApiError(error, 'Could not update availability.');
}

export async function setMenuItemVeg(id: string, isVeg: boolean): Promise<void> {
  const { error } = await supabase.from('menu_items').update({ is_veg: isVeg }).eq('id', id);
  if (error) throwApiError(error, 'Could not update veg flag.');
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) throwApiError(error, 'Could not delete menu item.');
}

export async function createMenuItem(input: {
  restaurantId: string;
  name: string;
  category: string;
  description: string;
  price: number;
  isAvailable: boolean;
  isVeg: boolean;
  imageUrl?: string;
}): Promise<DbMenuItem> {
  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      restaurant_id: input.restaurantId,
      name: input.name.trim(),
      category: input.category.trim() || null,
      description: input.description.trim() || null,
      price: input.price,
      is_available: input.isAvailable,
      is_veg: input.isVeg,
      image_url: input.imageUrl ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throwApiError(error ?? {}, 'Could not add menu item.');
  return data;
}

export async function uploadMenuImage(restaurantId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('menu-images').upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throwApiError(error, 'Could not upload photo.');
  const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
  return data.publicUrl;
}
