/**
 * Simple in-isolate sliding-window rate limit for Edge Functions.
 * Resets when the isolate is recycled — good enough for burst protection.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);
  if (bucket.timestamps.length >= opts.limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  bucket.timestamps.push(now);
  return { ok: true, remaining: opts.limit - bucket.timestamps.length };
}

/** Test helper — clear buckets between Deno tests. */
export function resetRateLimits() {
  buckets.clear();
}
