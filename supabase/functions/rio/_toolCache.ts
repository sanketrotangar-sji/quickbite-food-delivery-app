/** Tiny in-memory TTL cache for read-only RIO tools (edge isolate lifetime). */

type CacheEntry = { value: unknown; expiresAt: number };

const store = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

export function cachedTool<T>(
  tool: string,
  args: unknown,
  compute: () => Promise<T>,
): Promise<T> {
  const key = `${tool}:${JSON.stringify(args ?? {})}`;
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value as T);
  return compute().then((value) => {
    store.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  });
}
