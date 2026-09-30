import type { Tables } from '@/types/database';

import { throwApiError } from './errors';
import { supabase } from './supabaseClient';

export type TrackingRestaurant = Pick<
  Tables<'restaurants'>,
  'id' | 'name' | 'address' | 'image_url' | 'lat' | 'lng'
> & { phone: string | null };

export type TrackingRider = Pick<
  Tables<'profiles'>,
  'id' | 'full_name' | 'phone' | 'vehicle_label' | 'plate' | 'is_online'
>;

export type TrackingHistory = Pick<Tables<'order_status_history'>, 'id' | 'status' | 'changed_at'>;

export type TrackingLocation = Pick<
  Tables<'rider_locations'>,
  'rider_id' | 'order_id' | 'lat' | 'lng' | 'updated_at'
>;

export type TrackingItem = Pick<
  Tables<'order_items'>,
  'id' | 'item_name' | 'quantity' | 'unit_price' | 'menu_item_id'
> & {
  image_url: string | null;
  is_veg: boolean | null;
};

export type TrackedOrder = Tables<'orders'> & {
  restaurant: TrackingRestaurant | null;
  rider: TrackingRider | null;
  items: TrackingItem[];
  history: TrackingHistory[];
  riderLocation: TrackingLocation | null;
};

const ORDER_COLUMNS = `
  id, customer_id, restaurant_id, rider_id, status, total_amount, delivery_fee,
  delivery_address, delivery_address_id, delivery_lat, delivery_lng, notes,
  placed_at, delivered_at, updated_at, rider_earning, tip_amount, bonus_amount,
  pickup_km, drop_km, eta_minutes,
  order_items (id, item_name, quantity, unit_price, menu_item_id, menu_items (image_url, is_veg))
`;

export async function getTrackedOrder(id: string): Promise<TrackedOrder> {
  const orderResult = await supabase.from('orders').select(ORDER_COLUMNS).eq('id', id).maybeSingle();
  if (orderResult.error) throwApiError(orderResult.error, 'Could not load this order.');
  if (!orderResult.data) throw new Error('Order not found.');

  const order = orderResult.data;
  const [restaurantResult, historyResult, locationResult, riderResult] = await Promise.all([
    supabase
      .from('restaurant_browse')
      .select('id, name, address, image_url, lat, lng')
      .eq('id', order.restaurant_id)
      .maybeSingle(),
    supabase
      .from('order_status_history')
      .select('id, status, changed_at')
      .eq('order_id', id)
      .order('changed_at', { ascending: true }),
    order.rider_id
      ? supabase
          .from('rider_locations')
          .select('rider_id, order_id, lat, lng, updated_at')
          .eq('order_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    order.rider_id
      ? supabase
          .from('profiles')
          .select('id, full_name, phone, vehicle_label, plate, is_online')
          .eq('id', order.rider_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (restaurantResult.error) throwApiError(restaurantResult.error, 'Could not load the restaurant.');
  if (historyResult.error) throwApiError(historyResult.error, 'Could not load order updates.');
  if (locationResult.error) throwApiError(locationResult.error, 'Could not load the rider location.');

  const rawItems = (order.order_items ?? []) as {
    id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    menu_item_id: string | null;
    menu_items?: { image_url: string | null; is_veg: boolean } | null;
  }[];

  const { order_items: _items, ...orderRow } = order;

  return {
    ...(orderRow as Omit<typeof order, 'order_items'>),
    restaurant: restaurantResult.data ? { ...restaurantResult.data, phone: null } : null,
    rider: riderResult.error ? null : riderResult.data,
    items: rawItems.map((item) => ({
      id: item.id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      menu_item_id: item.menu_item_id,
      image_url: item.menu_items?.image_url ?? null,
      is_veg: item.menu_items?.is_veg ?? null,
    })),
    history: historyResult.data ?? [],
    riderLocation: locationResult.data,
  } as TrackedOrder;
}
