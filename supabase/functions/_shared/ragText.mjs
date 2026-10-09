/**
 * Canonical menu embedding string (no price/address):
 * "{restaurant} · {dish} · {category} · {Veg|Non-veg} · {tags} · {description}"
 * Keep in sync with type exports in ragText.ts.
 */
export function buildMenuItemText(item, restaurant) {
  const parts = [];

  const kitchen = restaurant?.name?.trim();
  if (kitchen) parts.push(kitchen);

  const dish = item?.name?.trim();
  if (dish) parts.push(dish);

  const category = item?.category?.trim();
  if (category) parts.push(category);

  parts.push(item?.is_veg === true ? "Veg" : "Non-veg");

  const tags = (item?.tags ?? [])
    .map((t) => String(t ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (tags) parts.push(tags);

  const description = item?.description?.trim();
  if (description) parts.push(description);

  return parts.join(" · ").trim();
}
