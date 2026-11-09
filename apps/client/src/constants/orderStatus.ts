import type { Enums } from '@quickbite/db';
import { colors } from './theme';

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
    color: colors.warning,
    background: colors.warningSoft,
    customerHint: 'Waiting for the restaurant to accept',
    riderHint: 'Not available yet',
  },
  preparing: {
    label: 'Preparing',
    color: colors.primary,
    background: colors.primarySoft,
    customerHint: 'Kitchen is on it',
    riderHint: 'Claim early — still cooking',
  },
  ready: {
    label: 'Ready',
    color: colors.forest,
    background: colors.successSoft,
    customerHint: 'Waiting for pickup',
    riderHint: 'Pick up now',
  },
  out_for_delivery: {
    label: 'On the way',
    color: colors.info,
    background: colors.infoSoft,
    customerHint: 'Rider is heading to you',
    riderHint: 'En route — tap delivered at the door',
  },
  delivered: {
    label: 'Delivered',
    color: colors.forest,
    background: colors.successSoft,
    customerHint: 'Enjoy — you can rate this order',
    riderHint: 'Completed',
  },
  cancelled: {
    label: 'Cancelled',
    color: colors.textMuted,
    background: colors.stepTrack,
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
