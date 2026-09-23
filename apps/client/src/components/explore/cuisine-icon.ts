import type { CuisineChip } from '@/components/home/CategoryChips';

export function iconForCategory(label: string): CuisineChip['icon'] {
  const text = label.toLowerCase();
  if (text.includes('north')) return 'nutrition-outline';
  if (text.includes('south')) return 'triangle-outline';
  if (text.includes('chinese') || text.includes('asian')) return 'restaurant-outline';
  if (text.includes('fast') || text.includes('burger')) return 'fast-food-outline';
  if (text.includes('pizza')) return 'pizza-outline';
  if (text.includes('dessert') || text.includes('sweet')) return 'ice-cream-outline';
  if (text.includes('biryani')) return 'flame-outline';
  if (text.includes('healthy') || text.includes('salad')) return 'leaf-outline';
  return 'restaurant-outline';
}
