import type { CustomerOrder } from '@/types/models';

import { throwApiError } from './errors';
import { supabase } from './supabaseClient';

export async function listCustomerOrders(): Promise<CustomerOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items (id, item_name, quantity, unit_price, menu_item_id)')
    .order('placed_at', { ascending: false });
  if (error) throwApiError(error, 'Could not load orders.');
  const rows = data ?? [];
  const ids = [...new Set(rows.map((row) => row.restaurant_id))];
  const kitchens = new Map<string, { name: string; image_url: string | null }>();
  if (ids.length > 0) {
    const browse = await supabase.from('restaurant_browse').select('id, name, image_url').in('id', ids);
    if (browse.error) throwApiError(browse.error, 'Could not load orders.');
    for (const row of browse.data ?? []) kitchens.set(row.id, { name: row.name, image_url: row.image_url });
  }
  return rows.map((row) => ({
    ...row,
    restaurants: kitchens.get(row.restaurant_id) ?? null,
  })) as CustomerOrder[];
}

export type PlaceOrderInput = {
  address: string;
  addressId?: string;
  lat?: number;
  lng?: number;
  notes?: string;
};

export async function placeOrder(input: PlaceOrderInput) {
  const { data, error } = await supabase.rpc('place_order', {
    p_delivery_address: input.address.trim(),
    p_delivery_address_id: input.addressId,
    p_delivery_lat: input.lat,
    p_delivery_lng: input.lng,
    p_notes: input.notes?.trim() ? input.notes.trim() : undefined,
  });
  if (error || !data) throwApiError(error ?? {}, 'Could not place order.');
  return data;
}
