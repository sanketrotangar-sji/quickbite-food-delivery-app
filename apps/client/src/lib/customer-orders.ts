import type { OrderStatus } from '@/constants/orderStatus';
import type { CustomerOrder } from '@/types/models';

export function isActiveOrderStatus(status: OrderStatus) {
  return status === 'placed' || status === 'preparing' || status === 'ready' || status === 'out_for_delivery';
}

export function pickActiveCustomerOrder(orders: CustomerOrder[]) {
  return orders
    .filter((order) => isActiveOrderStatus(order.status))
    .sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime())[0] ?? null;
}
