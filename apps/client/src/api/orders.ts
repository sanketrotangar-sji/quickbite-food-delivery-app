import type { OrderStatus } from '@/constants/orderStatus';
import type { CustomerOrder } from '@/types/models';

import { throwApiError } from './errors';
import { supabase } from './supabaseClient';

const ORDER_LIST_COLUMNS =
  'id, customer_id, restaurant_id, status, total_amount, delivery_fee, delivery_address, placed_at, updated_at, rider_id, eta_minutes';

async function attachKitchens(rows: Omit<CustomerOrder, 'restaurants' | 'order_items'>[]): Promise<CustomerOrder[]> {
  const ids = [...new Set(rows.map((row) => row.restaurant_id))];
  const kitchens = new Map<string, { name: string; image_url: string | null }>();
  if (ids.length > 0) {
    const browse = await supabase.from('restaurant_browse').select('id, name, image_url').in('id', ids);
    if (browse.error) throwApiError(browse.error, 'Could not load orders.');
    for (const row of browse.data ?? []) kitchens.set(row.id, { name: row.name, image_url: row.image_url });
  }
  return rows.map((row) => ({
    ...row,
    order_items: [],
    restaurants: kitchens.get(row.restaurant_id) ?? null,
  })) as CustomerOrder[];
}

export async function listCustomerOrders(): Promise<CustomerOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `${ORDER_LIST_COLUMNS}, order_items (id, item_name, quantity, unit_price, menu_item_id)`,
    )
    .order('placed_at', { ascending: false })
    .limit(40);
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

/** Lightweight active-order chip for the tab bar — no full history / line items. */
export async function fetchActiveCustomerOrder(): Promise<CustomerOrder | null> {
  const active: OrderStatus[] = ['placed', 'preparing', 'ready', 'out_for_delivery'];
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_LIST_COLUMNS)
    .in('status', active)
    .order('placed_at', { ascending: false })
    .limit(1);
  if (error) throwApiError(error, 'Could not load active order.');
  const rows = (data ?? []) as Omit<CustomerOrder, 'restaurants' | 'order_items'>[];
  if (rows.length === 0) return null;
  const [order] = await attachKitchens(rows);
  return order ?? null;
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
