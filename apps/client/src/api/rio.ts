import { FunctionsHttpError } from '@supabase/supabase-js';

import type { OrderStatus } from '@/constants/orderStatus';

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

export async function askRio(input: RioRequest): Promise<RioResponse> {
  const { data, error } = await supabase.functions.invoke('rio', { body: input });
  if (error) {
    let message = 'RIO could not answer just now.';
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // The function returned a non-JSON error page.
      }
    }
    throw new Error(message);
  }
  const payload = data as Partial<RioResponse> | null;
  if (!payload || typeof payload.text !== 'string') throw new Error('RIO could not answer just now.');
  return {
    text: payload.text,
    cards: Array.isArray(payload.cards) ? payload.cards : [],
    conflict: payload.conflict ?? null,
  };
}
