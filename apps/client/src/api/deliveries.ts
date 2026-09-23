import type { OrderStatus } from '@/constants/orderStatus';

import { throwApiError } from './errors';
import { supabase } from './supabaseClient';

export type RiderDelivery = {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  address: string;
  placedAt: string;
  deliveredAt: string | null;
  riderId: string | null;
  restaurantName: string;
  restaurantAddress: string;
  cuisine: string;
  imageUrl: string | null;
  itemsSummary: string;
  itemCount: number;
  earning: number;
  tip: number;
  bonus: number;
  pickupKm: number;
  dropKm: number;
  etaMinutes: number | null;
  notes: string | null;
  restaurantCoordinate: DeliveryCoordinate | null;
  customerCoordinate: DeliveryCoordinate | null;
};

export type DeliveryCoordinate = {
  latitude: number;
  longitude: number;
};

type OrderRow = {
  id: string;
  status: OrderStatus;
  total_amount: number;
  delivery_address: string;
  placed_at: string;
  delivered_at: string | null;
  restaurant_id: string;
  rider_id: string | null;
  customer_id: string;
  rider_earning: number | null;
  tip_amount: number | null;
  bonus_amount: number | null;
  pickup_km: number | null;
  drop_km: number | null;
  eta_minutes: number | null;
  notes: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  order_items: { item_name: string; quantity: number }[] | null;
};

const ORDER_COLUMNS = `
  id, status, total_amount, delivery_address, placed_at, delivered_at,
  restaurant_id, rider_id, customer_id, rider_earning, tip_amount, bonus_amount,
  pickup_km, drop_km, eta_minutes, notes, delivery_lat, delivery_lng,
  order_items (item_name, quantity)
`;

async function loadOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase.from('orders').select(ORDER_COLUMNS).order('placed_at', { ascending: false });
  if (error) throwApiError(error, 'Could not load deliveries.');
  return (data ?? []) as OrderRow[];
}

async function withKitchens(rows: OrderRow[]): Promise<RiderDelivery[]> {
  const ids = [...new Set(rows.map((row) => row.restaurant_id))];
  const kitchens = new Map<
    string,
    {
      name: string;
      address: string;
      cuisine: string;
      imageUrl: string | null;
      coordinate: DeliveryCoordinate | null;
    }
  >();
  if (ids.length > 0) {
    const browse = await supabase
      .from('restaurant_browse')
      .select('id, name, address, cuisine, description, image_url, lat, lng')
      .in('id', ids);
    if (browse.error) throwApiError(browse.error, 'Could not load deliveries.');
    for (const row of browse.data ?? []) {
      kitchens.set(row.id, {
        name: row.name,
        address: row.address,
        cuisine: row.description?.trim() || row.cuisine?.trim() || 'Kitchen',
        imageUrl: row.image_url,
        coordinate:
          row.lat == null || row.lng == null
            ? null
            : { latitude: Number(row.lat), longitude: Number(row.lng) },
      });
    }
  }
  return rows.map((row) => {
    const kitchen = kitchens.get(row.restaurant_id);
    const items = row.order_items ?? [];
    return {
      id: row.id,
      status: row.status,
      totalAmount: Number(row.total_amount),
      address: row.delivery_address,
      placedAt: row.placed_at,
      deliveredAt: row.delivered_at,
      riderId: row.rider_id,
      restaurantName: kitchen?.name ?? 'Kitchen',
      restaurantAddress: kitchen?.address ?? '',
      cuisine: kitchen?.cuisine ?? 'Kitchen',
      imageUrl: kitchen?.imageUrl ?? null,
      itemsSummary: items.map((item) => `${item.quantity}× ${item.item_name}`).join(', ') || 'No items listed',
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      earning: Number(row.rider_earning ?? 0),
      tip: Number(row.tip_amount ?? 0),
      bonus: Number(row.bonus_amount ?? 0),
      pickupKm: Number(row.pickup_km ?? 0),
      dropKm: Number(row.drop_km ?? 0),
      etaMinutes: row.eta_minutes,
      notes: row.notes,
      restaurantCoordinate: kitchen?.coordinate ?? null,
      customerCoordinate:
        row.delivery_lat == null || row.delivery_lng == null
          ? null
          : { latitude: Number(row.delivery_lat), longitude: Number(row.delivery_lng) },
    };
  });
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throwApiError(error ?? {}, 'Not signed in.');
  return data.user.id;
}

export async function listAvailableDeliveries(): Promise<RiderDelivery[]> {
  const userId = await currentUserId();
  const rows = await loadOrders();
  return withKitchens(
    rows.filter(
      (row) =>
        row.rider_id == null &&
        row.customer_id !== userId &&
        (row.status === 'preparing' || row.status === 'ready'),
    ),
  );
}

export async function listMyDeliveries(): Promise<RiderDelivery[]> {
  const userId = await currentUserId();
  const rows = await loadOrders();
  return withKitchens(
    rows.filter(
      (row) => row.rider_id === userId && row.status !== 'delivered' && row.status !== 'cancelled',
    ),
  );
}

export async function listDeliveryHistory(): Promise<RiderDelivery[]> {
  const userId = await currentUserId();
  const rows = await loadOrders();
  return withKitchens(
    rows.filter((row) => row.rider_id === userId && (row.status === 'delivered' || row.status === 'cancelled')),
  );
}

export async function claimDelivery(orderId: string) {
  const { error } = await supabase.rpc('claim_delivery', { p_order_id: orderId });
  if (error) throwApiError(error, 'Could not claim this delivery.');
}

export async function startDelivery(orderId: string) {
  const { error } = await supabase.rpc('rider_set_order_status', {
    p_order_id: orderId,
    p_status: 'out_for_delivery',
  });
  if (error) throwApiError(error, 'Could not start this delivery.');
}

export async function markDelivered(orderId: string) {
  const { error } = await supabase.rpc('rider_set_order_status', {
    p_order_id: orderId,
    p_status: 'delivered',
  });
  if (error) throwApiError(error, 'Could not mark this delivery.');
}
