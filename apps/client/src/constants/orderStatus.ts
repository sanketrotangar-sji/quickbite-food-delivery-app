import type { Enums } from '@/types/database';

export type OrderStatus = Enums<'order_status'>;

type StatusMeta = {
  label: string;
  color: string;
  background: string;
  customerHint: string;
  riderHint: string;
};

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  placed: {
    label: 'Placed',
    color: '#C97800',
    background: '#FFF1D6',
    customerHint: 'Waiting for the restaurant to accept',
    riderHint: 'Not available yet',
  },
  preparing: {
    label: 'Preparing',
    color: '#E85D04',
    background: '#FFE8D6',
    customerHint: 'Kitchen is on it',
    riderHint: 'Claim early — still cooking',
  },
  ready: {
    label: 'Ready',
    color: '#1B4332',
    background: '#D8F3DC',
    customerHint: 'Waiting for pickup',
    riderHint: 'Pick up now',
  },
  out_for_delivery: {
    label: 'On the way',
    color: '#1D4E89',
    background: '#D6E8FF',
    customerHint: 'Rider is heading to you',
    riderHint: 'En route — tap delivered at the door',
  },
  delivered: {
    label: 'Delivered',
    color: '#1B4332',
    background: '#E8F5E9',
    customerHint: 'Enjoy — you can rate this order',
    riderHint: 'Completed',
  },
  cancelled: {
    label: 'Cancelled',
    color: '#6B6B6B',
    background: '#ECECEC',
    customerHint: 'This order was cancelled',
    riderHint: 'Not available',
  },
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  'placed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
];

export function isStatusAtLeast(status: OrderStatus, min: OrderStatus) {
  if (status === 'cancelled') return false;
  return ORDER_STATUS_ORDER.indexOf(status) >= ORDER_STATUS_ORDER.indexOf(min);
}

/** UI actions — DB still enforces the real transitions. */
export function customerActions(status: OrderStatus) {
  return {
    canTrack: status !== 'cancelled',
    canRate: status === 'delivered',
  };
}

export function riderActions(status: OrderStatus, claimed: boolean) {
  return {
    canClaim: !claimed && (status === 'preparing' || status === 'ready'),
    canStartDelivery: claimed && status === 'ready',
    canMarkDelivered: claimed && status === 'out_for_delivery',
    showPreparingHint: !claimed && status === 'preparing',
    showReadyHint: !claimed && status === 'ready',
  };
}
