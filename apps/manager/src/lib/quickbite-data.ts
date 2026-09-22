export type OrderStatus =
  | "placed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type Order = {
  id: string;
  displayId: string;
  customer: string;
  elapsed: string;
  status: OrderStatus;
  items: { name: string; quantity: number; price: number; image: string; lineTotal: number }[];
  total: number;
  fulfillment: string;
  address: string;
  placedAt: string;
  riderId: string | null;
};

export type MenuItem = {
  id: string;
  name: string;
  restaurant: string;
  category: string;
  price: number;
  available: boolean;
  veg: boolean;
  image: string;
};
