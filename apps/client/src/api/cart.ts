import type { CartLine } from '@/types/models';

import { CartOtherRestaurantError, isOtherRestaurantError, throwApiError } from './errors';
import { supabase } from './supabaseClient';

export async function listCart(): Promise<CartLine[]> {
  const { data, error } = await supabase
    .from('cart_items')
    .select(
      'id, created_at, updated_at, customer_id, restaurant_id, menu_item_id, quantity, menu_items (id, name, price, image_url, is_available, is_veg)',
    )
    .order('created_at');
  if (error) throwApiError(error, 'Could not load cart.');
  const rows = data ?? [];
  const kitchens = await browseById(rows.map((row) => row.restaurant_id));
  return rows.map((row) => {
    const kitchen = kitchens.get(row.restaurant_id);
    return {
      ...row,
      restaurants: kitchen
        ? {
            id: kitchen.id,
            name: kitchen.name,
            is_open: kitchen.is_open,
            offer_percent: kitchen.offer_percent,
          }
        : null,
    } as CartLine;
  });
}

async function browseById(ids: string[]) {
  const unique = [...new Set(ids)];
  const map = new Map<string, { id: string; name: string; is_open: boolean; offer_percent: number | null }>();
  if (unique.length === 0) return map;
  const { data, error } = await supabase
    .from('restaurant_browse')
    .select('id, name, is_open, offer_percent')
    .in('id', unique);
  if (error) throwApiError(error, 'Could not load cart.');
  for (const row of data ?? []) {
    if (!row.id) continue;
    map.set(row.id, {
      id: row.id,
      name: row.name ?? 'Kitchen',
      is_open: Boolean(row.is_open),
      offer_percent: row.offer_percent,
    });
  }
  return map;
}

async function currentCartRestaurantName() {
  const { data } = await supabase.from('cart_items').select('restaurant_id').limit(1).maybeSingle();
  if (!data?.restaurant_id) return 'another restaurant';
  const kitchens = await browseById([data.restaurant_id]);
  return kitchens.get(data.restaurant_id)?.name ?? 'another restaurant';
}

export async function addCartItem(input: {
  customerId: string;
  menuItemId: string;
  restaurantId: string;
  quantity?: number;
}) {
  const count = Math.max(1, input.quantity ?? 1);
  const { data: existing, error: existingError } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('customer_id', input.customerId)
    .eq('menu_item_id', input.menuItemId)
    .maybeSingle();
  if (existingError) throwApiError(existingError, 'Could not update cart.');

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + count })
      .eq('id', existing.id);
    if (error) throwApiError(error, 'Could not update cart.');
    return;
  }

  const { error } = await supabase.from('cart_items').insert({
    customer_id: input.customerId,
    menu_item_id: input.menuItemId,
    restaurant_id: input.restaurantId,
    quantity: count,
  });

  if (error && isOtherRestaurantError(error)) {
    throw new CartOtherRestaurantError(await currentCartRestaurantName());
  }
  if (error) throwApiError(error, 'Could not add to cart.');
}

export async function setCartQuantity(cartItemId: string, quantity: number, customerId?: string) {
  if (cartItemId.startsWith('pending-')) {
    const menuItemId = cartItemId.replace(/^pending-/, '');
    // Resolve synthetic id to real db record
    let query = supabase.from('cart_items').select('id');
    if (customerId) query = query.eq('customer_id', customerId);
    const { data } = await query.eq('menu_item_id', menuItemId).maybeSingle();
    if (data?.id) {
      return setCartQuantity(data.id, quantity, customerId);
    }
    // If insert is still completing in flight, give it a brief moment
    await new Promise((r) => setTimeout(r, 250));
    let retryQuery = supabase.from('cart_items').select('id');
    if (customerId) retryQuery = retryQuery.eq('customer_id', customerId);
    const { data: retry } = await retryQuery.eq('menu_item_id', menuItemId).maybeSingle();
    if (retry?.id) {
      return setCartQuantity(retry.id, quantity, customerId);
    }
    return;
  }

  if (quantity < 1) {
    const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId);
    if (error) throwApiError(error, 'Could not update cart.');
    return;
  }
  const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', cartItemId);
  if (error) throwApiError(error, 'Could not update cart.');
}

export async function clearCart(customerId: string) {
  const { error } = await supabase.from('cart_items').delete().eq('customer_id', customerId);
  if (error) throwApiError(error, 'Could not clear cart.');
}
