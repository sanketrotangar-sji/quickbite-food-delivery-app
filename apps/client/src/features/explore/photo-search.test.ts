import { describe, expect, it } from 'vitest';

import {
  buildLocalVisionFallback,
  buildSamplePhotoOptions,
  visionDishToHomeDish,
} from './photo-search';
import type { HomeDish } from '@/lib/home-catalog';

const MOCK_DISHES: HomeDish[] = [
  {
    id: 'd-1',
    name: 'Mysore Masala Dosa',
    restaurantName: 'Udupi Bhavan',
    restaurantId: 'r-1',
    category: 'South Indian',
    price: 140,
    imageUrl: 'https://example.com/dosa.jpg',
    veg: true,
    discountPercent: 15,
  },
  {
    id: 'd-2',
    name: 'Hyderabadi Chicken Dum Biryani',
    restaurantName: 'Biryani Palace',
    restaurantId: 'r-2',
    category: 'Biryani',
    price: 280,
    imageUrl: 'https://example.com/biryani.jpg',
    veg: false,
  },
  {
    id: 'd-3',
    name: 'Paneer Butter Masala',
    restaurantName: 'Punjabi Tadka',
    restaurantId: 'r-3',
    category: 'Main Course',
    price: 220,
    imageUrl: 'https://example.com/paneer.jpg',
    veg: true,
  },
];

describe('buildSamplePhotoOptions', () => {
  it('picks real catalog dish image URLs when available', () => {
    const samples = buildSamplePhotoOptions(MOCK_DISHES);
    expect(samples.length).toBeGreaterThanOrEqual(3);
    expect(samples[0]).toMatchObject({
      label: 'Mysore Masala Dosa',
      imageUrl: 'https://example.com/dosa.jpg',
    });
    expect(samples[1]).toMatchObject({
      label: 'Hyderabadi Chicken Dum Biryani',
      imageUrl: 'https://example.com/biryani.jpg',
    });
  });

  it('returns default preset labels when catalog is empty', () => {
    const samples = buildSamplePhotoOptions([]);
    expect(samples.length).toBe(3);
    expect(samples[0].label).toBe('Masala Dosa');
  });
});

describe('visionDishToHomeDish', () => {
  it('maps VisionMatchedDish to HomeDish for cart addition', () => {
    const homeDish = visionDishToHomeDish({
      id: 'd-1',
      restaurantId: 'r-1',
      restaurantName: 'Udupi Bhavan',
      restaurantOpen: true,
      distanceKm: 1.8,
      offerPercent: 20,
      name: 'Masala Dosa',
      description: 'Crispy crepe',
      price: 120,
      imageUrl: 'https://example.com/dosa.jpg',
      isVeg: true,
      category: 'South Indian',
      tags: ['veg', 'dosa'],
      similarity: 0.94,
    });

    expect(homeDish).toEqual({
      id: 'd-1',
      name: 'Masala Dosa',
      restaurantName: 'Udupi Bhavan',
      restaurantId: 'r-1',
      category: 'South Indian',
      price: 120,
      imageUrl: 'https://example.com/dosa.jpg',
      veg: true,
      discountPercent: 20,
    });
  });
});

describe('buildLocalVisionFallback', () => {
  it('filters by vegOnly and ranks matching dishes', () => {
    const res = buildLocalVisionFallback('Masala Dosa', MOCK_DISHES, true);
    expect(res.ok).toBe(true);
    expect(res.analysis.isVeg).toBe(true);
    expect(res.analysis.category).toBe('South Indian');
    expect(res.dishes.length).toBeGreaterThan(0);
    expect(res.dishes[0].name).toBe('Mysore Masala Dosa');
    expect(res.dishes.every((d: { isVeg: boolean }) => d.isVeg)).toBe(true);
  });
});
