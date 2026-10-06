export type EarningsRange = 'today' | 'week' | 'month';

export type EarningsSnapshot = {
  total: number;
  deliveries: number;
  deliveryPay: number;
  bonuses: number;
  tips: number;
};

export type RiderNotice = {
  id: string;
  title: string;
  body: string;
  when: string;
  unread: boolean;
};

export const HELP_TOPICS = [
  {
    id: 'ready',
    title: 'Restaurant isn’t ready',
    body: 'Wait at the counter and mark that you’ve arrived. If it runs long, report an issue from the delivery screen.',
  },
  {
    id: 'customer',
    title: 'Customer unavailable',
    body: 'Call from the drop step. Wait a few minutes at the door, then report the customer as unavailable.',
  },
  {
    id: 'address',
    title: 'Wrong address',
    body: 'Follow the pin on the order. If the door doesn’t match, report a wrong address before you leave the food.',
  },
  {
    id: 'order',
    title: 'Order issue',
    body: 'Check the item count at pickup. Don’t leave the kitchen if a bag is missing.',
  },
  {
    id: 'pay',
    title: 'Payment or earnings',
    body: 'Delivery pay, bonuses, and tips show on Earnings. Cash orders are collected from the customer.',
  },
];

export const ISSUE_OPTIONS = [
  'Restaurant is closed',
  'Order isn’t ready',
  'Customer unavailable',
  'Wrong address',
  'Vehicle problem',
  'Other',
] as const;
