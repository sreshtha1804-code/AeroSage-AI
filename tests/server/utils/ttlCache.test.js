import { describe, expect, it } from 'vitest';
import { TtlCache } from '../../../server/utils/ttlCache.js';

const make = (overrides = {}) => {
  const clock = { now: 0 };
  const cache = new TtlCache({
    freshMs: 100,
    staleMs: 1000,
    maxEntries: 2,
    now: () => clock.now,
    ...overrides,
  });
  return { cache, clock };
};

describe('TtlCache', () => {
  it('serves fresh values and expires them after freshMs', () => {
    const { cache, clock } = make();
    cache.set('a', 1);
    expect(cache.getFresh('a')).toBe(1);
    clock.now = 100;
    expect(cache.getFresh('a')).toBeUndefined();
    expect(cache.getFresh('missing')).toBeUndefined();
  });

  it('keeps expired values available as stale (with their age) until staleMs', () => {
    const { cache, clock } = make();
    cache.set('a', 1);
    clock.now = 500;
    expect(cache.getStale('a')).toEqual({ value: 1, ageMs: 500 });
    clock.now = 1000;
    expect(cache.getStale('a')).toBeUndefined();
    expect(cache.size).toBe(0);
    expect(cache.getStale('never')).toBeUndefined();
  });

  it('evicts the oldest entry when full and refreshes position on overwrite', () => {
    const { cache } = make();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 11); // 'a' becomes newest
    cache.set('c', 3); // evicts 'b'
    expect(cache.getFresh('a')).toBe(11);
    expect(cache.getFresh('b')).toBeUndefined();
    expect(cache.getFresh('c')).toBe(3);
    expect(cache.size).toBe(2);
  });
});
