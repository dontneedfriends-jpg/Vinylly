import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { withCache, clearCache } from '../src/cache';

describe('withCache', () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches successful results within TTL', async () => {
    const loader = vi.fn().mockResolvedValue('value');
    const p1 = withCache('k', 1000, loader);
    const p2 = withCache('k', 1000, loader);
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads after TTL expires', async () => {
    const loader = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
    const first = await withCache('k', 1000, loader);
    expect(first).toBe('a');
    vi.advanceTimersByTime(1500);
    const second = await withCache('k', 1000, loader);
    expect(second).toBe('b');
  });
});
