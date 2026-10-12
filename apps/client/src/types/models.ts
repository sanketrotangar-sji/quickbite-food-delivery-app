import type { Tables } from '@/types/database';
import { APP_ROLES, type AppRole, hasRole, isPartner } from '@quickbite/shared';

export { APP_ROLES, type AppRole, hasRole, isPartner };

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
  created_at?: string;
  updated_at?: string;
};
export type MenuItem = Tables<'menu_items'>;
export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;
export type CartItem = Tables<'cart_items'>;
export type Application = Tables<'applications'>;
export type ManagerInvite = Tables<'manager_invites'>;


export type CartLine = CartItem & {
  menu_items: Pick<MenuItem, 'id' | 'name' | 'price' | 'image_url' | 'is_available' | 'is_veg'> | null;
  restaurants: Pick<Restaurant, 'id' | 'name' | 'is_open' | 'offer_percent'> | null;
};

export type CustomerOrder = Order & {
  restaurants: Pick<Restaurant, 'name' | 'image_url'> | null;
  order_items: Pick<OrderItem, 'id' | 'item_name' | 'quantity' | 'unit_price' | 'menu_item_id'>[];
};
