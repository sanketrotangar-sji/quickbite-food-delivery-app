import type { ImageSourcePropType } from 'react-native';

export type CompletedDelivery = {
  id: string;
  code: string;
  restaurantName: string;
  when: string;
  pickup: string;
  drop: string;
  distanceKm: number;
  earning: number;
  image: ImageSourcePropType;
};

export const COMPLETED_DELIVERIES: CompletedDelivery[] = [
  {
    id: 'qb7710',
    code: 'QB7710',
    restaurantName: 'The Tandoori Kitchen',
    when: 'Today, 1:10 PM',
    pickup: 'Campal',
    drop: 'Miramar',
    distanceKm: 4.6,
    earning: 78,
    image: require('../../../assets/images/chicken_tikka.png'),
  },
  {
    id: 'qb7688',
    code: 'QB7688',
    restaurantName: 'Dosa Plaza',
    when: 'Today, 12:05 PM',
    pickup: 'Margao market',
    drop: 'Fatorda',
    distanceKm: 7.9,
    earning: 92,
    image: require('../../../assets/images/masala_dosa.png'),
  },
  {
    id: 'qb7602',
    code: 'QB7602',
    restaurantName: 'Burger Hub',
    when: 'Yesterday, 8:40 PM',
    pickup: 'Panaji',
    drop: 'Taleigao',
    distanceKm: 10,
    earning: 66,
    image: require('../../../assets/images/misal_pav.png'),
  },
];

export type EarningsRange = 'today' | 'week' | 'month';

export type EarningsSnapshot = {
  total: number;
  deliveries: number;
  deliveryPay: number;
  bonuses: number;
  tips: number;
};

export const EARNINGS: Record<EarningsRange, EarningsSnapshot> = {
  today: { total: 1248, deliveries: 6, deliveryPay: 980, bonuses: 180, tips: 88 },
  week: { total: 6420, deliveries: 38, deliveryPay: 5100, bonuses: 820, tips: 500 },
  month: { total: 24860, deliveries: 142, deliveryPay: 20100, bonuses: 2860, tips: 1900 },
};

export const EARNINGS_BARS: Record<EarningsRange, { label: string; amount: number }[]> = {
  today: [
    { label: '9a', amount: 120 },
    { label: '11a', amount: 210 },
    { label: '1p', amount: 340 },
    { label: '3p', amount: 180 },
    { label: '5p', amount: 260 },
    { label: '7p', amount: 138 },
  ],
  week: [
    { label: 'Mon', amount: 820 },
    { label: 'Tue', amount: 640 },
    { label: 'Wed', amount: 910 },
    { label: 'Thu', amount: 760 },
    { label: 'Fri', amount: 1248 },
    { label: 'Sat', amount: 1100 },
    { label: 'Sun', amount: 942 },
  ],
  month: [
    { label: 'W1', amount: 5200 },
    { label: 'W2', amount: 6100 },
    { label: 'W3', amount: 5840 },
    { label: 'W4', amount: 7720 },
  ],
};

export const RECENT_EARNINGS = [
  { id: 'e1', title: 'Spice Villa', detail: 'Delivery pay · Green Park to Lake View · 2:15 PM', amount: 86 },
  { id: 'e2', title: 'Peak hour bonus', detail: 'Bonus on the Spice Villa trip · 1:40 PM', amount: 40 },
  { id: 'e3', title: 'The Tandoori Kitchen', detail: 'Delivery pay · Campal to Miramar · 1:10 PM', amount: 78 },
  { id: 'e4', title: 'Customer tip', detail: 'Tip from the Dosa Plaza drop · 12:20 PM', amount: 20 },
  { id: 'e5', title: 'Dosa Plaza', detail: 'Delivery pay · Margao market to Fatorda · 12:05 PM', amount: 92 },
];

export type RiderNotice = {
  id: string;
  title: string;
  body: string;
  when: string;
  unread: boolean;
};

export const RIDER_NOTICES: RiderNotice[] = [
  {
    id: 'n1',
    title: 'New delivery available',
    body: 'The Tandoori Kitchen is 1.4 km away. You earn ₹78.',
    when: '2 min ago',
    unread: true,
  },
  {
    id: 'n2',
    title: 'Order ready for pickup',
    body: 'Spice Villa marked order #QB7842 ready.',
    when: '18 min ago',
    unread: true,
  },
  {
    id: 'n3',
    title: 'Delivery completed',
    body: 'Dosa Plaza · #QB7688 is delivered.',
    when: 'Today, 12:20 PM',
    unread: false,
  },
  {
    id: 'n4',
    title: 'Earnings update',
    body: 'Today’s earnings are ₹1,248 across 6 deliveries.',
    when: 'Today, 12:21 PM',
    unread: false,
  },
  {
    id: 'n5',
    title: 'QuickBite',
    body: 'Peak hours in Margao run 12:30–2:30 PM and 7–10 PM.',
    when: 'Yesterday',
    unread: false,
  },
];

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
