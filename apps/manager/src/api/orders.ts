import { formatDistanceToNow } from 'date-fns';
import { isKitchenStatus as sharedIsKitchenStatus, nextKitchenStatus as sharedNextKitchenStatus } from '@quickbite/shared';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { Order, OrderStatus } from '@/lib/quickbite-data';

import { throwApiError } from './errors';

type OrderStatusDb = Database['public']['Enums']['order_status'];

type OrderQueryRow = {
  id: string;
  status: OrderStatusDb;
  total_amount: number;
  delivery_fee: number;
  delivery_address: string;
  rider_id: string | null;
  placed_at: string;
  updated_at: string;
  customer: { full_name: string | null } | null;
  rider: { full_name: string | null; phone: string | null } | null;
  order_items: {
    item_name: string;
    quantity: number;
    unit_price: number;
    line_total: number | null;
    menu_items: { image_url: string | null } | null;
  }[];
  order_status_history: { status: OrderStatusDb; changed_at: string }[] | null;
};

export function shortOrderId(id: string) {
  return id.replace(/-/g, '').slice(-6).toUpperCase();
}

export function riderPanelLabel(order: Pick<Order, 'status' | 'riderId' | 'riderName'>): string {
  const name = order.riderName?.trim();
  if (order.status === 'out_for_delivery' && order.riderId) {
    return name ? `On the way · ${name}` : 'On the way';
  }
  if (order.riderId) {
    return name ? `Assigned · ${name}` : 'Assigned';
  }
  return 'Unassigned';
}

function fulfillmentFor(row: OrderQueryRow) {
  const name = row.rider?.full_name?.trim();
  if (row.status === 'out_for_delivery' && row.rider_id) {
    return name ? `On the way · ${name}` : 'On the way';
  }
  if (row.rider_id) {
    return name ? `Assigned · ${name}` : 'Assigned';
  }
  if (row.status === 'ready') return 'Unassigned · Waiting for rider';
  return 'Unassigned';
}

export function toUiOrder(row: OrderQueryRow): Order {
  return {
    id: row.id,
    displayId: shortOrderId(row.id),
    customer: row.customer?.full_name?.trim() || 'Customer',
    elapsed: formatDistanceToNow(new Date(row.placed_at), { addSuffix: true }),
    status: row.status,
    items: (row.order_items ?? []).map((item) => ({
      name: item.item_name,
      quantity: item.quantity,
      price: Number(item.unit_price),
      image: item.menu_items?.image_url ?? '',
      lineTotal: item.line_total == null ? Number(item.unit_price) * item.quantity : Number(item.line_total),
    })),
    total: Number(row.total_amount),
    deliveryFee: Number(row.delivery_fee ?? 0),
    fulfillment: fulfillmentFor(row),
    address: row.delivery_address,
    placedAt: row.placed_at,
    riderId: row.rider_id,
    riderName: row.rider?.full_name?.trim() || null,
    riderPhone: row.rider?.phone?.trim() || null,
    history: [...(row.order_status_history ?? [])]
      .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
      .map((entry) => ({ status: entry.status, changedAt: entry.changed_at })),
  };
}

export type DbOrder = {
  id: string;
  status: OrderStatusDb;
  total_amount: number;
  placed_at: string;
  delivered_at: string | null;
};

export async function listRestaurantOrders(restaurantId: string): Promise<Order[]> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      status,
      total_amount,
      delivery_fee,
      delivery_address,
      rider_id,
      placed_at,
      updated_at,
      customer:profiles!orders_customer_id_fkey (full_name),
      rider:profiles!orders_rider_id_fkey (full_name, phone),
      order_items (
        item_name,
        quantity,
        unit_price,
        line_total,
        menu_items (image_url)
      ),
      order_status_history (status, changed_at)
    `,
    )
    .eq('restaurant_id', restaurantId)
    .or(`status.in.(placed,preparing,ready),placed_at.gte.${since.toISOString()}`)
    .order('placed_at', { ascending: false })
    .limit(100);
  if (error) throwApiError(error, 'Could not load orders.');
  return ((data ?? []) as unknown as OrderQueryRow[]).map(toUiOrder);
}

export type PerformanceOrder = {
  id: string;
  restaurant_id: string;
  status: OrderStatusDb;
  total_amount: number;
  placed_at: string;
  order_status_history: { status: OrderStatusDb; changed_at: string }[] | null;
};

export async function listPerformanceOrders(restaurantIds: string[]): Promise<PerformanceOrder[]> {
  if (restaurantIds.length === 0) return [];
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      restaurant_id,
      status,
      total_amount,
      placed_at,
      order_status_history (status, changed_at)
    `,
    )
    .in('restaurant_id', restaurantIds)
    .gte('placed_at', since.toISOString())
    .order('placed_at', { ascending: false })
    .limit(800);
  if (error) throwApiError(error, 'Could not load performance.');
  return (data ?? []) as unknown as PerformanceOrder[];
}

export async function listRestaurantOrderStats(restaurantId: string): Promise<DbOrder[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total_amount, placed_at, delivered_at')
    .eq('restaurant_id', restaurantId)
    .gte('placed_at', since.toISOString())
    .order('placed_at', { ascending: false })
    .limit(200);
  if (error) throwApiError(error, 'Could not load orders.');
  return data ?? [];
}

export async function setRestaurantOrderStatus(orderId: string, status: 'preparing' | 'ready' | 'cancelled') {
  const { error } = await supabase.rpc('restaurant_set_order_status', {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throwApiError(error, 'Could not update order status.');
}

export function isKitchenStatus(status: OrderStatus): status is 'placed' | 'preparing' | 'ready' {
  return sharedIsKitchenStatus(status);
}

export function nextKitchenStatus(status: OrderStatus): 'preparing' | 'ready' | null {
  return sharedNextKitchenStatus(status);
}
