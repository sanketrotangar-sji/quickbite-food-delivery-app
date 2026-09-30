import { FunctionsHttpError } from '@supabase/supabase-js';

import type { OrderStatus } from '@/constants/orderStatus';
import { RIO_USER_ERROR, userFacingRioError } from '@/lib/rio-errors';

import { supabase } from './supabaseClient';

export type RioRestaurant = {
  id: string;
  name: string;
  cuisine: string;
  dishName: string;
  imageUrl: string;
  address: string;
  isOpen: boolean;
  veg: boolean;
  offerPercent: number | null;
  prepMinutes: number | null;
};

export type RioMenuItem = {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isVeg: boolean;
  category: string | null;
};

export type RioCard =
  | { kind: 'restaurants'; places: RioRestaurant[] }
  | { kind: 'menu'; restaurantId: string; restaurantName: string; items: RioMenuItem[] }
  | {
      kind: 'cart';
      restaurantName: string;
      lines: { name: string; quantity: number; unitPrice: number }[];
      total: number;
      confirm: boolean;
      needsAddress: boolean;
    }
  | {
      kind: 'order';
      id: string;
      restaurantName: string;
      imageUrl: string | null;
      status: OrderStatus;
      total: number;
      placedAt: string;
      itemsSummary: string;
      address: string;
    }
  | {
      kind: 'ticket';
      id: string;
      orderId: string;
      issueType: string;
      urgency: string;
      status: string;
    };

export type RioConflict = {
  menuItemId: string;
  itemName: string;
  currentRestaurant: string;
};

export type RioResponse = {
  text: string;
  cards: RioCard[];
  conflict: RioConflict | null;
};

type RioRequest = {
  messages?: { role: 'user' | 'assistant'; content: string }[];
  deliveryAddress?: string | null;
  deliveryAddressId?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  action?: 'confirm_order' | 'replace_cart';
  menuItemId?: string;
  context?: string;
};

async function parseInvokeError(error: unknown): Promise<string> {
  let raw = error instanceof Error ? error.message : 'RIO invoke failed';
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) raw = body.error;
    } catch {
      // Non-JSON error page.
    }
  }
  return raw;
}

/** Non-stream path for confirm/replace actions. */
export async function askRio(input: RioRequest): Promise<RioResponse> {
  const { data, error } = await supabase.functions.invoke('rio', { body: input });
  if (error) {
    const raw = await parseInvokeError(error);
    console.warn('[RIO] askRio failed:', raw, error);
    throw new Error(userFacingRioError(raw));
  }
  const payload = data as Partial<RioResponse> | null;
  if (!payload || typeof payload.text !== 'string') {
    console.warn('[RIO] Invalid response payload', payload);
    throw new Error(RIO_USER_ERROR);
  }
  return {
    text: payload.text,
    cards: Array.isArray(payload.cards) ? payload.cards : [],
    conflict: payload.conflict ?? null,
  };
}

export type AskRioStreamHandlers = {
  onToken?: (token: string) => void;
};

/** NDJSON stream for chat turns — tokens paint live; cards arrive on done. */
export async function askRioStream(input: RioRequest, handlers: AskRioStreamHandlers = {}): Promise<RioResponse> {
  if (input.action) return askRio(input);

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error(RIO_USER_ERROR);

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Sign in to talk to RIO.');

  const response = await fetch(`${url}/functions/v1/rio`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...input, stream: true }),
  });

  if (!response.ok) {
    let raw = `RIO HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) raw = body.error;
    } catch {
      // ignore
    }
    throw new Error(userFacingRioError(raw));
  }

  const reader = response.body?.getReader();
  if (!reader) {
    // Some runtimes buffer the whole body — fall back to text parse.
    const text = await response.text();
    return parseNdjsonBody(text, handlers.onToken);
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalText = '';
  let cards: RioCard[] = [];
  let conflict: RioConflict | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: { type?: string; text?: string; cards?: RioCard[]; conflict?: RioConflict | null; error?: string };
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (event.type === 'token' && typeof event.text === 'string') {
        finalText += event.text;
        handlers.onToken?.(event.text);
      } else if (event.type === 'done') {
        if (typeof event.text === 'string' && event.text) finalText = event.text;
        cards = Array.isArray(event.cards) ? event.cards : [];
        conflict = event.conflict ?? null;
      } else if (event.type === 'error') {
        throw new Error(userFacingRioError(event.error ?? RIO_USER_ERROR));
      }
    }
  }

  if (!finalText) throw new Error(RIO_USER_ERROR);
  return { text: finalText, cards, conflict };
}

function parseNdjsonBody(body: string, onToken?: (token: string) => void): RioResponse {
  let finalText = '';
  let cards: RioCard[] = [];
  let conflict: RioConflict | null = null;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as {
        type?: string;
        text?: string;
        cards?: RioCard[];
        conflict?: RioConflict | null;
        error?: string;
      };
      if (event.type === 'token' && typeof event.text === 'string') {
        finalText += event.text;
        onToken?.(event.text);
      } else if (event.type === 'done') {
        if (typeof event.text === 'string' && event.text) finalText = event.text;
        cards = Array.isArray(event.cards) ? event.cards : [];
        conflict = event.conflict ?? null;
      } else if (event.type === 'error') {
        throw new Error(userFacingRioError(event.error ?? RIO_USER_ERROR));
      }
    } catch (error) {
      if (error instanceof Error && error.message !== RIO_USER_ERROR) throw error;
    }
  }
  if (!finalText) throw new Error(RIO_USER_ERROR);
  return { text: finalText, cards, conflict };
}
