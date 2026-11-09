import { userFacingMessage } from '@quickbite/api/errors';
import { userFacingRioError } from '@/lib/rio-errors';

export type ErrorCode =
  | 'NETWORK'
  | 'NOT_SIGNED_IN'
  | 'CART_EMPTY'
  | 'CART_MIXED'
  | 'CART_OTHER_RESTAURANT'
  | 'ITEM_UNAVAILABLE'
  | 'RESTAURANT_CLOSED'
  | 'DELIVERY_RANGE'
  | 'ADDRESS_REQUIRED'
  | 'ADDRESS_NOT_FOUND'
  | 'SELF_ORDER'
  | 'ORDER_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'UNKNOWN';

export type ErrorCopy = { code: ErrorCode; title: string; message: string };

const COPY: Record<Exclude<ErrorCode, 'UNKNOWN'>, Omit<ErrorCopy, 'code'>> = {
  NETWORK: { title: "You're offline", message: 'Check your connection and try again.' },
  NOT_SIGNED_IN: { title: 'Sign in needed', message: 'Sign in to continue.' },
  CART_EMPTY: { title: 'Cart is empty', message: 'Add a dish before checking out.' },
  CART_MIXED: {
    title: 'One kitchen per order',
    message: 'Your cart has items from another kitchen. Clear it to order from here.',
  },
  CART_OTHER_RESTAURANT: {
    title: 'One kitchen per order',
    message: 'Your cart has items from another kitchen. Clear it to order from here.',
  },
  ITEM_UNAVAILABLE: {
    title: 'Item sold out',
    message: 'Something in your cart just went out of stock. Remove it and try again.',
  },
  RESTAURANT_CLOSED: { title: 'Kitchen is closed', message: 'This kitchen is not taking orders right now.' },
  DELIVERY_RANGE: {
    title: 'Too far to deliver',
    message: 'This kitchen cannot reach the selected address. Pick a closer address or another kitchen.',
  },
  ADDRESS_REQUIRED: { title: 'Add a delivery address', message: 'Choose where this order should go.' },
  ADDRESS_NOT_FOUND: {
    title: 'Address missing',
    message: 'That address was removed. Pick another delivery address.',
  },
  SELF_ORDER: { title: 'Not allowed', message: "You can't order from a kitchen you manage." },
  ORDER_NOT_FOUND: { title: 'Order not found', message: 'This order is no longer available.' },
  INVALID_TRANSITION: {
    title: 'Order already updated',
    message: 'The order changed in the meantime. Pull to refresh.',
  },
};

const PATTERNS: [RegExp, ErrorCode][] = [
  [/fetch failed|network request failed|failed to fetch|networkerror|timeout/i, 'NETWORK'],
  [/not signed in|jwt|sign in/i, 'NOT_SIGNED_IN'],
  [/CART_EMPTY/, 'CART_EMPTY'],
  [/CART_MIXED/, 'CART_MIXED'],
  [/CART_OTHER_RESTAURANT|different restaurant/i, 'CART_OTHER_RESTAURANT'],
  [/ITEM_UNAVAILABLE/, 'ITEM_UNAVAILABLE'],
  [/RESTAURANT_CLOSED/, 'RESTAURANT_CLOSED'],
  [/DELIVERY_RANGE|outside .*range/i, 'DELIVERY_RANGE'],
  [/delivery address is required/i, 'ADDRESS_REQUIRED'],
  [/ADDRESS_NOT_FOUND/, 'ADDRESS_NOT_FOUND'],
  [/SELF_ORDER/, 'SELF_ORDER'],
  [/order not found/i, 'ORDER_NOT_FOUND'],
  [/INVALID_TRANSITION/, 'INVALID_TRANSITION'],
];

function rawText(error: unknown) {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    return `${code ?? ''} ${error.message}`;
  }
  return typeof error === 'string' ? error : '';
}

/** One place that turns RPC / network failures into title + body copy for toasts and screens. */
export function errorCopy(error: unknown, fallbackTitle = 'Something went wrong'): ErrorCopy {
  const raw = rawText(error);
  const match = PATTERNS.find(([pattern]) => pattern.test(raw));
  if (match) return { code: match[1], ...COPY[match[1] as Exclude<ErrorCode, 'UNKNOWN'>] };
  return { code: 'UNKNOWN', title: fallbackTitle, message: userFacingMessage(error) };
}

export function rioErrorCopy(error: unknown): ErrorCopy {
  return { code: 'UNKNOWN', title: 'RIO hit a snag', message: userFacingRioError(error) };
}
