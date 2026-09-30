/**
 * Prefer Storage sibling thumbs written by scripts/optimize-menu-images.mjs
 * (`foo.png` → `foo.sm.webp`) when showing small UI slots.
 */
export type ImageSlot = 'thumb' | 'hero' | 'full';

export function getDisplayImageUrl(url: string | null | undefined, slot: ImageSlot = 'full'): string {
  if (!url) return '';
  if (slot === 'full' || slot === 'hero') return url;
  if (!url.includes('/storage/v1/object/public/')) return url;
  if (/\.sm\.webp(\?|$)/i.test(url)) return url;
  return url.replace(/\.(png|jpe?g|webp)(\?|$)/i, '.sm.webp$2');
}
