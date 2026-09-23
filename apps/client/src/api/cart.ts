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
      restaurants: kitchen ? { id: kitchen.id, name: kitchen.name, is_open: kitchen.is_open } : null,
    } as CartLine;
  });
}

async function browseById(ids: string[]) {
  const unique = [...new Set(ids)];
  const map = new Map<string, { id: string; name: string; is_open: boolean }>();
  if (unique.length === 0) return map;
  const { data, error } = await supabase
    .from('restaurant_browse')
    .select('id, name, is_open')
    .in('id', unique);
  if (error) throwApiError(error, 'Could not load cart.');
  for (const row of data ?? []) map.set(row.id, row);
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
}) {
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
      .update({ quantity: existing.quantity + 1 })
      .eq('id', existing.id);
    if (error) throwApiError(error, 'Could not update cart.');
    return;
  }

  const { error } = await supabase.from('cart_items').insert({
    customer_id: input.customerId,
    menu_item_id: input.menuItemId,
    restaurant_id: input.restaurantId,
    quantity: 1,
  });

  if (error && isOtherRestaurantError(error)) {
    throw new CartOtherRestaurantError(await currentCartRestaurantName());
  }
  if (error) throwApiError(error, 'Could not add to cart.');
}

export async function setCartQuantity(cartItemId: string, quantity: number) {
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
