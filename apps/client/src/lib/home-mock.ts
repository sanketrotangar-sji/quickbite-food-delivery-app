export type HomeCategory = {
  id: string;
  label: string;
  emoji?: string;
  imageUrl: string;
};

export type HomeDish = {
  id: string;
  name: string;
  restaurantName: string;
  restaurantId: string;
  category: string;
  price: number;
  imageUrl: string;
  veg: boolean;
  discountPercent?: number;
};

export type HomePlace = {
  id: string;
  name: string;
  cuisine: string;
  dishName: string;
  rating: number | null;
  imageUrl: string;
  address: string;
  isOpen: boolean;
  veg: boolean;
  hasNonVeg: boolean;
  categoryIds: string[];
  offerPercent: number | null;
  prepMinutes: number | null;
};

export type HomeHighlight = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  kind: 'offer' | 'video';
  restaurantId: string | null;
  restaurantName: string;
  badge: string;
  ctaLabel: string;
};

export type MockPromo = {
  id: string;
  title: string;
  subtitle: string;
  accent: 'primary' | 'dark';
  imageUrl: string;
};

export const HOME_LOCATION = 'Margao, Goa';
export const POPULAR_CATEGORY_ID = 'popular';
export const VEG_CATEGORY_ID = 'veg';

export type DietFilter = 'all' | 'veg' | 'nonveg';

export function greetingName(fullName?: string | null, email?: string | null) {
  const fromName = fullName?.trim().split(/\s+/).filter(Boolean)[0];
  if (fromName) return fromName;
  const local = email?.split('@')[0] ?? '';
  const token = local.split(/[._-]/)[0];
  if (!token) return 'there';
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export function categorySlug(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, '-');
}

export function filterHomeDishes(dishes: HomeDish[], categoryId: string, query: string, diet: DietFilter) {
  const needle = query.trim().toLowerCase();
  const vegDiet = diet === 'veg' || categoryId === VEG_CATEGORY_ID;
  const nonvegDiet = diet === 'nonveg' && categoryId !== VEG_CATEGORY_ID;
  return dishes.filter((dish) => {
    if (vegDiet && !dish.veg) return false;
    if (nonvegDiet && dish.veg) return false;
    const inCategory =
      categoryId === POPULAR_CATEGORY_ID ||
      categoryId === VEG_CATEGORY_ID ||
      categorySlug(dish.category) === categoryId;
    if (!inCategory) return false;
    if (!needle) return true;
    return (
      dish.name.toLowerCase().includes(needle) ||
      dish.restaurantName.toLowerCase().includes(needle) ||
      dish.category.toLowerCase().includes(needle)
    );
  });
}

export function filterHomePlaces(places: HomePlace[], categoryId: string, query: string, diet: DietFilter) {
  const needle = query.trim().toLowerCase();
  const vegDiet = diet === 'veg' || categoryId === VEG_CATEGORY_ID;
  const nonvegDiet = diet === 'nonveg' && categoryId !== VEG_CATEGORY_ID;
  return places
    .filter((place) => {
      if (vegDiet && !place.veg) return false;
      if (nonvegDiet && !place.hasNonVeg) return false;
      const inCategory =
        categoryId === POPULAR_CATEGORY_ID ||
        categoryId === VEG_CATEGORY_ID ||
        place.categoryIds.includes(categoryId);
      if (!inCategory) return false;
      if (!needle) return true;
      return (
        place.name.toLowerCase().includes(needle) ||
        place.cuisine.toLowerCase().includes(needle) ||
        place.dishName.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => Number(b.isOpen) - Number(a.isOpen));
}
