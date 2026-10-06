/**
 * Prefer Storage sibling thumbs written by scripts/optimize-menu-images.mjs
 * (`foo.png` → `foo.sm.webp`) when showing list/banner/hero UI slots.
 * Use `full` only when the user needs the original asset.
 */
export type ImageSlot = 'thumb' | 'hero' | 'full';

export function getDisplayImageUrl(url: string | null | undefined, slot: ImageSlot = 'full'): string {
  if (!url) return '';
  if (slot === 'full') return url;
  if (!url.includes('/storage/v1/object/public/')) return url;
  if (/\.sm\.webp(\?|$)/i.test(url)) return url;
  // hero + thumb both use the sibling thumb on Free tier (no Image Transforms).
  return url.replace(/\.(png|jpe?g|webp)(\?|$)/i, '.sm.webp$2');
}
