import { normalizeFoodTags } from '@quickbite/domain';
import type { Database } from '@quickbite/db';

import { throwApiError } from '../errors';
import { db } from '../supabase';

export type DbMenuItem = Database['public']['Tables']['menu_items']['Row'];

const MENU_SELECT_COLUMNS =
  'id, restaurant_id, name, description, price, image_url, is_available, is_veg, category, tags, created_at, updated_at';

export async function listMenuItems(restaurantId: string): Promise<DbMenuItem[]> {
  const { data, error } = await db()
    .from('menu_items')
    .select(MENU_SELECT_COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('name');
  if (error) throwApiError(error, 'Could not load menu.');
  return (data ?? []) as DbMenuItem[];
}

export async function setMenuItemAvailability(id: string, isAvailable: boolean): Promise<void> {
  const { error } = await db().from('menu_items').update({ is_available: isAvailable }).eq('id', id);
  if (error) throwApiError(error, 'Could not update availability.');
}

export async function setMenuItemVeg(id: string, isVeg: boolean): Promise<void> {
  const { error } = await db().from('menu_items').update({ is_veg: isVeg }).eq('id', id);
  if (error) throwApiError(error, 'Could not update veg flag.');
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await db().from('menu_items').delete().eq('id', id);
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
  tags?: string[];
  imageUrl?: string;
}): Promise<DbMenuItem> {
  const cleanTags = normalizeFoodTags(input.tags ?? [], { isVeg: input.isVeg });
  const { data, error } = await db()
    .from('menu_items')
    .insert({
      restaurant_id: input.restaurantId,
      name: input.name.trim(),
      category: input.category.trim() || null,
      description: input.description.trim() || null,
      price: input.price,
      is_available: input.isAvailable,
      is_veg: input.isVeg,
      tags: cleanTags,
      image_url: input.imageUrl ?? null,
    })
    .select(MENU_SELECT_COLUMNS)
    .single();
  if (error || !data) throwApiError(error ?? {}, 'Could not add menu item.');
  return data as DbMenuItem;
}

export async function updateMenuItemReview(
  id: string,
  input: {
    name?: string;
    category: string;
    description?: string;
    price?: number;
    isVeg: boolean;
    tags: string[];
    imageUrl?: string;
  },
): Promise<DbMenuItem> {
  const cleanTags = normalizeFoodTags(input.tags, { isVeg: input.isVeg });
  const patch: Database['public']['Tables']['menu_items']['Update'] = {
    category: input.category.trim() || null,
    is_veg: input.isVeg,
    tags: cleanTags,
    updated_at: new Date().toISOString(),
  };
  if (typeof input.name === 'string' && input.name.trim()) {
    patch.name = input.name.trim();
  }
  if (typeof input.description === 'string') {
    patch.description = input.description.trim() || null;
  }
  if (typeof input.price === 'number' && !Number.isNaN(input.price) && input.price >= 0) {
    patch.price = input.price;
  }
  if (typeof input.imageUrl === 'string' && input.imageUrl.trim()) {
    patch.image_url = input.imageUrl.trim();
  }

  const { data, error } = await db()
    .from('menu_items')
    .update(patch)
    .eq('id', id)
    .select(MENU_SELECT_COLUMNS)
    .single();
  if (error || !data) throwApiError(error ?? {}, 'Could not save reviewed tags and item details.');
  return data as DbMenuItem;
}

export async function uploadMenuThumb(originalPath: string, blob: Blob): Promise<void> {
  const thumbPath = originalPath.replace(/\.(png|jpe?g|webp)$/i, '.sm.webp');
  await db().storage.from('menu-images').upload(thumbPath, blob, {
    contentType: 'image/webp',
    upsert: true,
  });
}

export async function uploadMenuImage(restaurantId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db().storage.from('menu-images').upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throwApiError(error, 'Could not upload photo.');
  void import('@/lib/images')
    .then(({ fileToThumbBlob }) => fileToThumbBlob(file))
    .then((blob) => (blob ? uploadMenuThumb(path, blob) : undefined))
    .catch(() => {});
  const { data } = db().storage.from('menu-images').getPublicUrl(path);
  return data.publicUrl;
}

export * from '../vision';
