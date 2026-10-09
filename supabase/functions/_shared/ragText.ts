/** Shared RAG chunk text builders — keep backfill + edge embed paths identical. */

export type MenuItemTextInput = {
  name?: string | null;
  category?: string | null;
  description?: string | null;
  is_veg?: boolean | null;
  tags?: string[] | null;
};

export type RestaurantTextInput = {
  name?: string | null;
};

export { buildMenuItemText } from "./ragText.mjs";
