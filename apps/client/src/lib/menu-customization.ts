import type { MenuItem } from '@/types/models';

export type DishChoice = { id: string; label: string };

const CUSTOMIZABLE = /pizza|burger|biryani|coffee|thali|combo|bowl|wrap|dosa|noodles|pasta/;

export function customizationFor(item: Pick<MenuItem, 'name' | 'category'>) {
  const text = `${item.name} ${item.category ?? ''}`.toLowerCase();
  if (!CUSTOMIZABLE.test(text)) return null;
  return {
    sizes: [
      { id: 'regular', label: 'Regular' },
      { id: 'large', label: 'Large' },
    ] satisfies DishChoice[],
    addons: [
      { id: 'cheese', label: 'Extra cheese' },
      { id: 'spicy', label: 'Extra spicy' },
      { id: 'gravy', label: 'Extra gravy' },
    ] satisfies DishChoice[],
  };
}
