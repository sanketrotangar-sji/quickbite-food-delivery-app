import { getDisplayImageUrl, type ImageSlot } from '@quickbite/domain';

export { getDisplayImageUrl, type ImageSlot };

/** Mirror client thumb rewrite for manager list previews (Free-tier sibling .sm.webp). */
export function displayImageUrl(url: string | null | undefined, slot: 'thumb' | 'full' = 'thumb'): string {
  return getDisplayImageUrl(url, slot);
}

/** Resize & encode a browser File into a compact JPEG data URL (< 600 KB) for vision AI analysis. */
export async function fileToVisionDataUrl(file: File, maxDim = 768): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      return canvas.toDataURL('image/jpeg', 0.82);
    }
    bitmap.close();
  } catch {
    // Fallback to FileReader below
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read the selected photo file.'));
    reader.readAsDataURL(file);
  });
}


/** Resize a browser File to a max ~400px WebP thumbnail blob for menu previews. */
export async function fileToThumbBlob(file: File): Promise<Blob | null> {
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
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return await new Promise((resolve) =>
      canvas.toBlob((value) => resolve(value), 'image/webp', 0.75),
    );
  } catch {
    return null;
  }
}
