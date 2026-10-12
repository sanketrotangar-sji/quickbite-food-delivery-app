import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabaseClient';

WebBrowser.maybeCompleteAuthSession();

type CreatePaymentIntentResponse = {
  ok?: boolean;
  url?: string;
  checkoutSessionId?: string;
  paymentIntentId?: string | null;
  error?: string;
  detail?: string;
  paymentStatus?: string;
};

export type CheckoutSessionResult = {
  status: 'success' | 'paid' | 'cancelled' | 'dismissed' | 'failed';
  message?: string;
  url?: string;
};

function paymentErrorMessage(data: CreatePaymentIntentResponse | null | undefined, fallback: string) {
  const reason = data?.detail || data?.error || fallback;
  switch (reason) {
    case 'already_paid':
      return 'This order is already paid.';
    case 'stripe_not_configured':
      return 'Card payments are not configured yet.';
    case 'order_cancelled':
      return 'This order was cancelled.';
    case 'forbidden':
      return 'You cannot pay for this order.';
    default:
      return typeof reason === 'string' && reason.length < 120 ? reason : fallback;
  }
}

/** Deep-link URLs Stripe will redirect to after Checkout (scheme from app.json). */
export function buildStripeReturnUrls(orderId: string) {
  const returnBase = Linking.createURL(`/orders/${orderId}`);
  const join = returnBase.includes('?') ? '&' : '?';
  return {
    returnBase,
    successUrl: `${returnBase}${join}paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${returnBase}${join}paid=0`,
  };
}

export function parsePaymentReturnUrl(url: string): { orderId: string | null; paid: '1' | '0' | null } {
  try {
    const parsed = Linking.parse(url);
    const path = (parsed.path ?? '').replace(/^\//, '');
    // paths like orders/<uuid> or (customer)/orders/<uuid>
    const match = path.match(/orders\/([0-9a-f-]{36})/i);
    const orderId = match?.[1] ?? null;
    const paidRaw = parsed.queryParams?.paid;
    const paid =
      paidRaw === '1' || paidRaw === '0'
        ? paidRaw
        : Array.isArray(paidRaw) && (paidRaw[0] === '1' || paidRaw[0] === '0')
          ? (paidRaw[0] as '1' | '0')
          : null;
    return { orderId, paid };
  } catch {
    return { orderId: null, paid: null };
  }
}

export async function startTestCardCheckout(orderId: string): Promise<{ url: string }> {
  const { successUrl, cancelUrl } = buildStripeReturnUrls(orderId);
  const { data, error } = await supabase.functions.invoke<CreatePaymentIntentResponse>(
    'create-payment-intent',
    { body: { orderId, successUrl, cancelUrl } },
  );

  if (error) {
    throw new Error(error.message || 'Could not start card checkout.');
  }
  if (data?.error === 'already_paid' || data?.paymentStatus === 'paid') {
    throw new Error(paymentErrorMessage(data, 'This order is already paid.'));
  }
  if (!data?.url) {
    throw new Error(paymentErrorMessage(data, 'Could not start card checkout.'));
  }
  return { url: data.url };
}

/**
 * Opens Stripe Checkout in an auth session and returns when the app deep-link comes back.
 */
export async function openTestCardCheckout(orderId: string): Promise<CheckoutSessionResult> {
  const { url } = await startTestCardCheckout(orderId);
  const { returnBase } = buildStripeReturnUrls(orderId);

  if (Platform.OS === 'android') {
    await WebBrowser.warmUpAsync();
  }
  let result: Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>;
  try {
    result = await WebBrowser.openAuthSessionAsync(url, returnBase);
  } finally {
    if (Platform.OS === 'android') {
      await WebBrowser.coolDownAsync();
    }
  }

  if (result.type === 'cancel') {
    return { status: 'dismissed', message: 'Checkout was closed.' };
  }
  if (result.type !== 'success' || !('url' in result) || !result.url) {
    return { status: 'failed', message: 'Payment did not complete.' };
  }

  const { paid } = parsePaymentReturnUrl(result.url);
  if (paid === '1') {
    return { status: 'success', url: result.url };
  }
  if (paid === '0') {
    return { status: 'cancelled', message: 'Payment was cancelled.', url: result.url };
  }
  return { status: 'success', url: result.url };
}
