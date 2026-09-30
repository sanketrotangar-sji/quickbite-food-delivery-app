#!/usr/bin/env node
/**
 * Batch-optimize public menu-images in Supabase Storage (Free plan — no Image Transforms).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/optimize-menu-images.mjs [--dry-run]
 *
 * - Resizes originals to max 1200px long edge and recompresses (overwrite same path).
 * - Writes sibling thumbs: foo.png → foo.sm.webp (~400px).
 * Never commit the service role key.
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import WebSocket from 'ws';

// supabase-js realtime expects a WebSocket constructor; Node 20 has none.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const BUCKET = 'menu-images';
const DRY = process.argv.includes('--dry-run');
const MAX_HERO = 1200;
const MAX_THUMB = 400;
const HERO_QUALITY = 80;
const THUMB_QUALITY = 75;

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});

async function listAll(prefix = '') {
  const out = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data?.length) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have id null / no metadata size in some API versions.
      if (entry.id === null || (entry.metadata == null && !entry.name.includes('.'))) {
        out.push(...(await listAll(path)));
      } else if (/\.(png|jpe?g|webp)$/i.test(entry.name) && !/\.sm\.webp$/i.test(entry.name)) {
        out.push(path);
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function optimizeOne(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  const input = Buffer.from(await data.arrayBuffer());
  const before = input.length;

  const hero = await sharp(input)
    .rotate()
    .resize({ width: MAX_HERO, height: MAX_HERO, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: HERO_QUALITY, mozjpeg: true })
    .toBuffer();

  const thumb = await sharp(input)
    .rotate()
    .resize({ width: MAX_THUMB, height: MAX_THUMB, fit: 'cover' })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();

  const thumbPath = path.replace(/\.(png|jpe?g|webp)$/i, '.sm.webp');
  // Keep original extension path but store JPEG bytes when rewriting non-webp.
  // For .png/.jpg URLs already in DB we overwrite with JPEG content (browsers/RN still decode).
  const contentType = path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const heroBody = path.toLowerCase().endsWith('.webp')
    ? await sharp(input)
        .rotate()
        .resize({ width: MAX_HERO, height: MAX_HERO, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: HERO_QUALITY })
        .toBuffer()
    : hero;

  console.log(
    `${DRY ? '[dry-run] ' : ''}${path}: ${(before / 1024).toFixed(0)}KB → hero ${(heroBody.length / 1024).toFixed(0)}KB + thumb ${(thumb.length / 1024).toFixed(0)}KB`,
  );

  if (DRY) return;

  const upHero = await supabase.storage.from(BUCKET).upload(path, heroBody, {
    upsert: true,
    contentType,
    cacheControl: '31536000',
  });
  if (upHero.error) throw upHero.error;

  const upThumb = await supabase.storage.from(BUCKET).upload(thumbPath, thumb, {
    upsert: true,
    contentType: 'image/webp',
    cacheControl: '31536000',
  });
  if (upThumb.error) throw upThumb.error;
}

const paths = await listAll();
console.log(`Found ${paths.length} images in ${BUCKET}`);
for (const path of paths) {
  try {
    await optimizeOne(path);
  } catch (cause) {
    console.error(`Failed ${path}:`, cause instanceof Error ? cause.message : cause);
  }
}
console.log('Done.');
