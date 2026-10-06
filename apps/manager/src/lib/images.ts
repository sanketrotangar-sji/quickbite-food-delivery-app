/** Mirror client thumb rewrite for manager list previews (Free-tier sibling .sm.webp). */
export function displayImageUrl(url: string | null | undefined, slot: 'thumb' | 'full' = 'thumb'): string {
  if (!url) return '';
  if (slot === 'full') return url;
  if (!url.includes('/storage/v1/object/public/')) return url;
  if (/\.sm\.webp(\?|$)/i.test(url)) return url;
  return url.replace(/\.(png|jpe?g|webp)(\?|$)/i, '.sm.webp$2');
}

/** Browser-side sibling thumb after menu upload (max ~400px WebP). */
export async function uploadSiblingThumb(originalPath: string, file: File): Promise<void> {
  const { supabase } = await import('@/integrations/supabase/client');
  try {
    const bitmap = await createImageBitmap(file);
    const max = 400;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((value) => resolve(value), 'image/webp', 0.75),
    );
    if (!blob) return;
    const thumbPath = originalPath.replace(/\.(png|jpe?g|webp)$/i, '.sm.webp');
    await supabase.storage.from('menu-images').upload(thumbPath, blob, {
      contentType: 'image/webp',
      upsert: true,
    });
  } catch {
    // Best-effort — originals still work; batch script can backfill thumbs.
  }
}
