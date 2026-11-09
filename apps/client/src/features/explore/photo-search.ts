import { inferAttributesFromText, normalizeFoodTags } from '@quickbite/domain';
import type { VisionMatchedDish, VisionSearchResponse } from '@quickbite/api/vision';

import type { HomeDish } from '@/lib/home-catalog';

export type SamplePhotoOption = {
  id: string;
  label: string;
  dishHint: string;
  imageUrl: string;
};

const DEFAULT_SAMPLES: Array<{ id: string; label: string; dishHint: string; keyword: string }> = [
  { id: 'sample-dosa', label: 'Masala Dosa', dishHint: 'Masala Dosa', keyword: 'dosa' },
  { id: 'sample-biryani', label: 'Chicken Biryani', dishHint: 'Chicken Dum Biryani', keyword: 'biryani' },
  { id: 'sample-paneer', label: 'Paneer Butter Masala', dishHint: 'Paneer Butter Masala', keyword: 'paneer' },
  { id: 'sample-fish', label: 'Goan Fish Curry', dishHint: 'Goan Fish Curry', keyword: 'fish' },
  { id: 'sample-dessert', label: 'Gulab Jamun', dishHint: 'Gulab Jamun', keyword: 'gulab' },
];

/**
 * Build real food photo sample options from the loaded catalog (with real `https://` image URLs)
 * so Android/iOS phone users can test live Vision photo search with one tap even without
 * taking a camera photo first.
 */
export function buildSamplePhotoOptions(allDishes: HomeDish[]): SamplePhotoOption[] {
  const withImages = allDishes.filter((d) => /^https?:\/\//i.test(d.imageUrl));
  const usedIds = new Set<string>();
  const out: SamplePhotoOption[] = [];

  for (const preset of DEFAULT_SAMPLES) {
    const match = withImages.find(
      (d) => !usedIds.has(d.id) && d.name.toLowerCase().includes(preset.keyword),
    );
    if (match) {
      usedIds.add(match.id);
      out.push({
        id: preset.id,
        label: match.name,
        dishHint: match.name,
        imageUrl: match.imageUrl,
      });
    }
  }

  for (const d of withImages) {
    if (out.length >= 5) break;
    if (usedIds.has(d.id)) continue;
    usedIds.add(d.id);
    out.push({
      id: `catalog-${d.id}`,
      label: d.name,
      dishHint: d.name,
      imageUrl: d.imageUrl,
    });
  }

  if (out.length === 0) {
    return DEFAULT_SAMPLES.slice(0, 3).map((p) => ({
      id: p.id,
      label: p.label,
      dishHint: p.dishHint,
      imageUrl: '',
    }));
  }

  return out.slice(0, 5);
}

/**
 * Convert a `VisionMatchedDish` from the Edge function into a `HomeDish` for cart addition.
 */
export function visionDishToHomeDish(item: VisionMatchedDish): HomeDish {
  return {
    id: item.id,
    name: item.name,
    restaurantName: item.restaurantName,
    restaurantId: item.restaurantId,
    category: item.category,
    price: item.price,
    imageUrl: item.imageUrl,
    veg: item.isVeg,
    discountPercent: item.offerPercent > 0 ? item.offerPercent : undefined,
  };
}

/**
 * Build a resilient local catalog fallback response when scanning a known dish sample
 * or when the network is temporarily degraded.
 */
export function buildLocalVisionFallback(
  dishHint: string,
  allDishes: HomeDish[],
  vegOnly: boolean,
): VisionSearchResponse {
  const inferred = inferAttributesFromText({ name: dishHint });
  const hintLower = dishHint.trim().toLowerCase();
  const tokens = hintLower.split(/\s+/).filter((t) => t.length > 2);

  const scored = allDishes
    .filter((d) => !vegOnly || d.veg)
    .map((d) => {
      const nameLower = d.name.toLowerCase();
      const catLower = d.category.toLowerCase();
      let score = 0;
      if (nameLower === hintLower) score += 0.96;
      else if (nameLower.includes(hintLower)) score += 0.85;
      else {
        for (const tok of tokens) {
          if (nameLower.includes(tok)) score += 0.35;
          else if (catLower.includes(tok)) score += 0.15;
        }
      }
      if (catLower === inferred.category.toLowerCase()) score += 0.2;
      if (d.veg === inferred.isVeg) score += 0.08;
      return { dish: d, score: Math.min(0.98, score) };
    })
    .filter((x) => x.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const dishes: VisionMatchedDish[] = scored.map(({ dish, score }) => ({
    id: dish.id,
    restaurantId: dish.restaurantId,
    restaurantName: dish.restaurantName,
    restaurantOpen: true,
    distanceKm: null,
    offerPercent: dish.discountPercent ?? 0,
    name: dish.name,
    description: dish.category,
    price: dish.price,
    imageUrl: dish.imageUrl,
    isVeg: dish.veg,
    category: dish.category,
    tags: normalizeFoodTags([dish.veg ? 'veg' : 'non-veg', dish.category, ...inferred.tags], {
      isVeg: dish.veg,
      spiceLevel: inferred.spiceLevel,
    }),
    similarity: Number(score.toFixed(2)),
  }));

  return {
    ok: true,
    analysis: {
      isFood: true,
      dishName: dishHint,
      cuisine: inferred.cuisine,
      category: inferred.category,
      isVeg: inferred.isVeg,
      spiceLevel: inferred.spiceLevel,
      tags: inferred.tags,
      caption: `${inferred.cuisine} ${dishHint} (${inferred.isVeg ? 'Vegetarian' : 'Non-vegetarian'})`,
      confidence: 0.9,
      provider: 'vision-hybrid',
      model: 'qwen-vision',
    },
    dishes,
  };
}
