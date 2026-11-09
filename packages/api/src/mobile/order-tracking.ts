import type { Tables } from '@quickbite/db';

import { throwApiError } from '../errors';
import { db } from '../supabase';

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

export async function getTrackedOrder(id: string): Promise<TrackedOrder> {
  const { data, error } = await db().rpc('order_tracking', { p_order_id: id });
  if (error) throwApiError(error, 'Could not load this order.');
  if (!data) throw new Error('Order not found.');
  const order = data as unknown as TrackedOrder;
  return {
    ...order,
    items: order.items ?? [],
    history: order.history ?? [],
  };
}
