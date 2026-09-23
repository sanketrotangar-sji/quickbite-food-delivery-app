import { categorySlug } from '@/lib/home-mock';
import type { MenuItem } from '@/types/models';

export type MenuSection = {
  id: string;
  label: string;
  items: MenuItem[];
};

export function menuSections(items: MenuItem[]): MenuSection[] {
  const recommended = items.filter((item) => item.is_available).slice(0, 4);
  const recommendedIds = new Set(recommended.map((item) => item.id));
  const groups = new Map<string, MenuItem[]>();
  for (const item of items) {
    if (recommendedIds.has(item.id)) continue;
    const label = item.category?.trim() || 'More';
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  const sections: MenuSection[] = [];
  if (recommended.length > 0) sections.push({ id: 'recommended', label: 'Recommended', items: recommended });
  for (const [label, list] of groups) {
    sections.push({ id: categorySlug(label) || 'menu', label, items: list });
  }
  if (sections.length === 0 && items.length > 0) sections.push({ id: 'menu', label: 'Menu', items });
  return sections;
}

export function priceForTwo(prices: number[]) {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = sorted[Math.floor((sorted.length - 1) / 2)] ?? sorted[0];
  return Math.max(10, Math.round((mid * 2) / 10) * 10);
}
