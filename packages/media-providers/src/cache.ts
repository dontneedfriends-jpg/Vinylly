interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface InflightEntry {
  promise: Promise<unknown>;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, InflightEntry>();

export async function withCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  const existing = inflight.get(key);
  if (existing) {
    return existing.promise as Promise<T>;
  }
  const p = loader()
    .then((value) => {
      memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, { promise: p });
  return p;
}

export function clearCache(): void {
  memoryCache.clear();
  inflight.clear();
}
