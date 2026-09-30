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
  customerName: string | null;
  customerPhone: string | null;
  /** True when drop details are redacted (unclaimed pool). */
  redacted?: boolean;
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

async function withKitchens(rows: OrderRow[]): Promise<RiderDelivery[]> {
  const ids = [...new Set(rows.map((row) => row.restaurant_id))];
  const customerIds = [...new Set(rows.map((row) => row.customer_id))];
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
  const customers = new Map<string, { name: string | null; phone: string | null }>();
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
  if (customerIds.length > 0) {
    const profiles = await supabase.from('profiles').select('id, full_name, phone').in('id', customerIds);
    if (!profiles.error) {
      for (const row of profiles.data ?? []) {
        customers.set(row.id, { name: row.full_name, phone: row.phone });
      }
    }
  }
  return rows.map((row) => {
    const kitchen = kitchens.get(row.restaurant_id);
    const customer = customers.get(row.customer_id);
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
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
    };
  });
}

async function loadAssignedOrders(userId: string, statuses: OrderStatus[]): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('rider_id', userId)
    .in('status', statuses)
    .order('placed_at', { ascending: false });
  if (error) throwApiError(error, 'Could not load deliveries.');
  return (data ?? []) as OrderRow[];
}

export async function listAvailableDeliveries(): Promise<RiderDelivery[]> {
  const { data, error } = await supabase.rpc('list_rider_delivery_pool');
  if (error) throwApiError(error, 'Could not load available deliveries.');
  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status as OrderStatus,
    totalAmount: Number(row.total_amount),
    address: row.area_hint ? `Drop near ${row.area_hint.trim()}` : 'Drop area revealed after claim',
    placedAt: row.placed_at,
    deliveredAt: null,
    riderId: null,
    restaurantName: row.restaurant_name,
    restaurantAddress: row.restaurant_address,
    cuisine: row.cuisine,
    imageUrl: row.image_url,
    itemsSummary: row.items_summary,
    itemCount: Number(row.item_count ?? 0),
    earning: Number(row.rider_earning ?? 0),
    tip: Number(row.tip_amount ?? 0),
    bonus: Number(row.bonus_amount ?? 0),
    pickupKm: Number(row.pickup_km ?? 0),
    dropKm: Number(row.drop_km ?? 0),
    etaMinutes: row.eta_minutes,
    notes: null,
    restaurantCoordinate:
      row.restaurant_lat == null || row.restaurant_lng == null
        ? null
        : { latitude: Number(row.restaurant_lat), longitude: Number(row.restaurant_lng) },
    customerCoordinate: null,
    customerName: null,
    customerPhone: null,
    redacted: true,
  }));
}

export async function listMyDeliveries(userId: string): Promise<RiderDelivery[]> {
  return withKitchens(await loadAssignedOrders(userId, ['preparing', 'ready', 'out_for_delivery', 'placed']));
}

export async function listDeliveryHistory(userId: string): Promise<RiderDelivery[]> {
  return withKitchens(await loadAssignedOrders(userId, ['delivered', 'cancelled']));
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
