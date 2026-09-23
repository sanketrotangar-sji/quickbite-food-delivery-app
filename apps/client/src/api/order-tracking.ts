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

export type TrackingHistory = Pick<
  Tables<'order_status_history'>,
  'id' | 'status' | 'changed_at'
>;

export type TrackingLocation = Pick<
  Tables<'rider_locations'>,
  'rider_id' | 'order_id' | 'lat' | 'lng' | 'updated_at'
>;

export type TrackedOrder = Tables<'orders'> & {
  restaurant: TrackingRestaurant | null;
  rider: TrackingRider | null;
  items: Pick<Tables<'order_items'>, 'id' | 'item_name' | 'quantity' | 'unit_price'>[];
  history: TrackingHistory[];
  riderLocation: TrackingLocation | null;
};

export async function getTrackedOrder(id: string): Promise<TrackedOrder> {
  const orderResult = await supabase
    .from('orders')
    .select('*, order_items (id, item_name, quantity, unit_price)')
    .eq('id', id)
    .maybeSingle();
  if (orderResult.error) throwApiError(orderResult.error, 'Could not load this order.');
  if (!orderResult.data) throw new Error('Order not found.');

  const order = orderResult.data;
  const [restaurantResult, historyResult, locationResult] = await Promise.all([
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
      ? supabase.from('rider_locations').select('rider_id, order_id, lat, lng, updated_at').eq('order_id', id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (restaurantResult.error) throwApiError(restaurantResult.error, 'Could not load the restaurant.');
  if (historyResult.error) throwApiError(historyResult.error, 'Could not load order updates.');
  if (locationResult.error) throwApiError(locationResult.error, 'Could not load the rider location.');

  let rider: TrackingRider | null = null;
  if (order.rider_id) {
    // Profile visibility is policy-controlled. Tracking remains useful if details are hidden.
    const riderResult = await supabase
      .from('profiles')
      .select('id, full_name, phone, vehicle_label, plate, is_online')
      .eq('id', order.rider_id)
      .maybeSingle();
    if (!riderResult.error) rider = riderResult.data;
  }

  return {
    ...order,
    restaurant: restaurantResult.data ? { ...restaurantResult.data, phone: null } : null,
    rider,
    items: order.order_items ?? [],
    history: historyResult.data ?? [],
    riderLocation: locationResult.data,
  } as TrackedOrder;
}
