import { formatDistanceToNow } from 'date-fns';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { Order, OrderStatus } from '@/lib/quickbite-data';

import { throwApiError } from './errors';

type OrderStatusDb = Database['public']['Enums']['order_status'];

type OrderQueryRow = {
  id: string;
  status: OrderStatusDb;
  total_amount: number;
  delivery_address: string;
  rider_id: string | null;
  placed_at: string;
  updated_at: string;
  customer: { full_name: string | null } | null;
  order_items: {
    item_name: string;
    quantity: number;
    unit_price: number;
    line_total: number | null;
    menu_items: { image_url: string | null } | null;
  }[];
};

const KITCHEN_STATUSES: OrderStatus[] = ['placed', 'preparing', 'ready'];

export function shortOrderId(id: string) {
  return id.replace(/-/g, '').slice(-6).toUpperCase();
}

function fulfillmentFor(row: OrderQueryRow) {
  if (row.rider_id) return 'Delivery · Rider assigned';
  if (row.status === 'ready') return 'Pickup · Waiting for rider';
  return 'Delivery · Rider assignment pending';
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
    fulfillment: fulfillmentFor(row),
    address: row.delivery_address,
    placedAt: row.placed_at,
    riderId: row.rider_id,
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
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      status,
      total_amount,
      delivery_address,
      rider_id,
      placed_at,
      updated_at,
      customer:profiles!orders_customer_id_fkey (full_name),
      order_items (
        item_name,
        quantity,
        unit_price,
        line_total,
        menu_items (image_url)
      )
    `,
    )
    .eq('restaurant_id', restaurantId)
    .order('placed_at', { ascending: false });
  if (error) throwApiError(error, 'Could not load orders.');
  return ((data ?? []) as unknown as OrderQueryRow[]).map(toUiOrder);
}

export type PerformanceOrder = {
  restaurant_id: string;
  status: OrderStatusDb;
  total_amount: number;
  placed_at: string;
};

export async function listPerformanceOrders(restaurantIds: string[]): Promise<PerformanceOrder[]> {
  if (restaurantIds.length === 0) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('restaurant_id, status, total_amount, placed_at')
    .in('restaurant_id', restaurantIds);
  if (error) throwApiError(error, 'Could not load performance.');
  return data ?? [];
}

export async function listRestaurantOrderStats(restaurantId: string): Promise<DbOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total_amount, placed_at, delivered_at')
    .eq('restaurant_id', restaurantId)
    .order('placed_at', { ascending: false });
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
  return (KITCHEN_STATUSES as string[]).includes(status);
}

export function nextKitchenStatus(status: OrderStatus): 'preparing' | 'ready' | null {
  if (status === 'placed') return 'preparing';
  if (status === 'preparing') return 'ready';
  return null;
}
