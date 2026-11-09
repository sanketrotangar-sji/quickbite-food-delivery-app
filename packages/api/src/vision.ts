import {
  inferAttributesFromText,
  normalizeFoodTags,
  validateImageDataUrl,
  type VisionAnalysis,
} from '@quickbite/domain';

import { ApiError } from './errors';
import { db } from './supabase';

export type { VisionAnalysis };

export type VisionMatchedDish = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantOpen: boolean;
  distanceKm: number | null;
  offerPercent: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isVeg: boolean;
  category: string;
  tags: string[];
  similarity: number;
};

export type VisionSearchResponse = {
  ok: true;
  analysis: VisionAnalysis;
  dishes: VisionMatchedDish[];
  noticeCode?: 'NOT_FOOD_IMAGE' | 'NO_MATCHES_IN_RANGE';
  notice?: string;
};

type EdgeVisionPayload = {
  ok?: boolean;
  code?: string;
  error?: string;
  analysis?: VisionAnalysis;
  dishes?: VisionMatchedDish[];
  noticeCode?: 'NOT_FOOD_IMAGE' | 'NO_MATCHES_IN_RANGE';
  notice?: string;
};

async function extractErrorPayload(
  error: unknown,
  payload?: EdgeVisionPayload | null,
): Promise<EdgeVisionPayload | null> {
  if (payload && typeof payload === 'object') return payload;
  const ctx =
    error && typeof error === 'object' && 'context' in error
      ? (error as { context?: { clone?: () => { json: () => Promise<unknown> }; json?: () => Promise<unknown> } })
          .context
      : null;
  if (!ctx) return null;
  try {
    if (typeof ctx.clone === 'function') {
      return (await ctx.clone().json()) as EdgeVisionPayload;
    }
    if (typeof ctx.json === 'function') {
      return (await ctx.json()) as EdgeVisionPayload;
    }
  } catch {
    return null;
  }
  return null;
}

async function mapVisionInvokeError(
  error: unknown,
  payload?: EdgeVisionPayload | null,
): Promise<never> {
  const body = await extractErrorPayload(error, payload);
  if (body && typeof body === 'object') {
    const code = typeof body.code === 'string' ? body.code : 'VISION_ERROR';
    const message =
      typeof body.error === 'string' && body.error.trim()
        ? body.error.trim()
        : 'Could not analyze that photo. Please try again.';
    throw new ApiError(message, code);
  }

  if (error instanceof ApiError) throw error;

  const rawMsg = error instanceof Error ? error.message : String(error ?? '');
  if (/429|rate|quickly/i.test(rawMsg)) {
    throw new ApiError(
      "You're scanning photos too quickly. Please wait a moment and try again.",
      'RATE_LIMITED',
    );
  }
  if (/fetch failed|network|failed to fetch|offline|timeout/i.test(rawMsg)) {
    throw new ApiError(
      'Network problem while analyzing photo. Check your connection and try again.',
      'NETWORK_ERROR',
    );
  }
  throw new ApiError(
    'Photo analysis is temporarily unavailable. Please try again in a few seconds.',
    'VISION_UNAVAILABLE',
  );
}

/**
 * Customer flow: Find dishes by photo (`vision-food` Edge Function, mode = "search").
 * Accepts either a base64 `imageDataUrl` or a remote `imageUrl` (plus optional `dishNameHint`).
 */
export async function searchDishesByPhoto(input: {
  imageDataUrl?: string | null;
  imageUrl?: string | null;
  dishNameHint?: string | null;
  lat?: number | null;
  lng?: number | null;
  vegOnly?: boolean;
  limit?: number;
}): Promise<VisionSearchResponse> {
  const imageDataUrl = input.imageDataUrl?.trim() ?? '';
  const imageUrl = input.imageUrl?.trim() ?? '';

  if (!imageDataUrl && !imageUrl) {
    throw new ApiError(
      'Please choose a clear food photo (JPG, PNG, or WebP under 4 MB).',
      'IMAGE_MISSING',
    );
  }

  if (imageDataUrl) {
    const valid = validateImageDataUrl(imageDataUrl);
    if (!valid.ok) {
      throw new ApiError(valid.message, valid.code);
    }
  } else if (!/^https?:\/\//i.test(imageUrl)) {
    throw new ApiError(
      'Unsupported photo URL. Please choose a valid JPG, PNG, or WebP image.',
      'IMAGE_INVALID_FORMAT',
    );
  }

  const { data, error } = await db().functions.invoke<EdgeVisionPayload>('vision-food', {
    body: {
      mode: 'search',
      ...(imageDataUrl ? { imageDataUrl } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(input.dishNameHint?.trim() ? { dishNameHint: input.dishNameHint.trim() } : {}),
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      vegOnly: Boolean(input.vegOnly),
      limit: input.limit ?? 9,
    },
  });

  if (error || !data || data.ok !== true || !data.analysis) {
    return await mapVisionInvokeError(error, data);
  }

  return {
    ok: true,
    analysis: {
      ...data.analysis,
      tags: normalizeFoodTags(data.analysis.tags, {
        isVeg: data.analysis.isVeg,
        spiceLevel: data.analysis.spiceLevel,
      }),
    },
    dishes: Array.isArray(data.dishes) ? data.dishes : [],
    ...(data.noticeCode ? { noticeCode: data.noticeCode } : {}),
    ...(data.notice ? { notice: data.notice } : {}),
  };
}

/**
 * Manager/Owner flow: Auto-tag a dish photo (`vision-food` Edge Function, mode = "autotag").
 * Includes a resilient client-side domain fallback if the Edge function is unreachable
 * and a dish name/description hint is present.
 */
export async function suggestDishTagsFromPhoto(input: {
  imageDataUrl?: string | null;
  imageUrl?: string | null;
  dishNameHint?: string | null;
  descriptionHint?: string | null;
  categoryHint?: string | null;
}): Promise<VisionAnalysis> {
  const imageDataUrl = input.imageDataUrl?.trim() ?? '';
  const imageUrl = input.imageUrl?.trim() ?? '';

  if (!imageDataUrl && !imageUrl) {
    throw new ApiError(
      'Please upload or select a food photo first to generate AI tags.',
      'IMAGE_MISSING',
    );
  }

  if (imageDataUrl) {
    const valid = validateImageDataUrl(imageDataUrl);
    if (!valid.ok) {
      throw new ApiError(valid.message, valid.code);
    }
  }

  const { data, error } = await db().functions.invoke<EdgeVisionPayload>('vision-food', {
    body: {
      mode: 'autotag',
      ...(imageDataUrl ? { imageDataUrl } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      dishNameHint: input.dishNameHint?.trim() || null,
      descriptionHint: input.descriptionHint?.trim() || null,
      categoryHint: input.categoryHint?.trim() || null,
    },
  });

  if (data && data.ok === true && data.analysis) {
    return {
      ...data.analysis,
      tags: normalizeFoodTags(data.analysis.tags, {
        isVeg: data.analysis.isVeg,
        spiceLevel: data.analysis.spiceLevel,
      }),
    };
  }

  if (input.dishNameHint?.trim() || input.descriptionHint?.trim()) {
    const inferred = inferAttributesFromText({
      name: input.dishNameHint,
      description: input.descriptionHint,
      category: input.categoryHint,
    });
    const dishName = input.dishNameHint?.trim() || inferred.category;
    return {
      isFood: true,
      dishName,
      cuisine: inferred.cuisine,
      category: inferred.category,
      isVeg: inferred.isVeg,
      spiceLevel: inferred.spiceLevel,
      tags: inferred.tags,
      caption: `${inferred.cuisine} ${dishName} (${inferred.isVeg ? 'Vegetarian' : 'Non-vegetarian'})`,
      confidence: 0.78,
      provider: 'domain-fallback',
      model: 'quickbite-rules',
    };
  }

  return await mapVisionInvokeError(error, data);
}
