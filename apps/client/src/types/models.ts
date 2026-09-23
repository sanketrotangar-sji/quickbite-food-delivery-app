import type { Tables } from '@/types/database';

export const APP_ROLES = [
  'customer',
  'restaurant_manager',
  'restaurant_owner',
  'rider',
  'admin',
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type Profile = Tables<'profiles'> & { roles: AppRole[] };
export type Restaurant = Tables<'restaurants'>;
export type RestaurantBrowse = {
  id: string;
  name: string;
  description: string | null;
  cuisine: string | null;
  address: string;
  image_url: string | null;
  is_open: boolean;
  branch_name: string | null;
  lat: number | null;
  lng: number | null;
  offer_percent: number | null;
  prep_minutes: number | null;
  created_at: string;
  updated_at: string;
};
export type MenuItem = Tables<'menu_items'>;
export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;
export type CartItem = Tables<'cart_items'>;
export type Application = Tables<'applications'>;
export type ManagerInvite = Tables<'manager_invites'>;

export function hasRole(profile: { role: AppRole } | null | undefined, role: AppRole) {
  return profile?.role === role;
}

export function isPartner(profile: { role: AppRole } | null | undefined) {
  return hasRole(profile, 'restaurant_owner') || hasRole(profile, 'restaurant_manager');
}

export type CartLine = CartItem & {
  menu_items: Pick<MenuItem, 'id' | 'name' | 'price' | 'image_url' | 'is_available' | 'is_veg'> | null;
  restaurants: Pick<Restaurant, 'id' | 'name' | 'is_open'> | null;
};

export type CustomerOrder = Order & {
  restaurants: Pick<Restaurant, 'name' | 'image_url'> | null;
  order_items: Pick<OrderItem, 'id' | 'item_name' | 'quantity' | 'unit_price' | 'menu_item_id'>[];
};
