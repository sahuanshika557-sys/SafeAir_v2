import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCATION, DEFAULT_PROFILE } from '../../src/constants/index.js';
import { buildAqiCacheKey, buildPlanCacheKey, TtlCache } from '../../src/utils/cache.js';
import { SlidingWindowRateLimiter } from '../../src/utils/rateLimiter.js';

describe('TtlCache and cache keys', () => {
  it('stores, retrieves, and expires entries after TTL', () => {
    const cache = new TtlCache<number>(1000, 3);
    cache.set('a', 42, 1000, 10000);
    expect(cache.get('a', 10500)).toBe(42);
    expect(cache.has('a', 10500)).toBe(true);
    expect(cache.get('a', 11000)).toBeUndefined();
    expect(cache.has('a', 11000)).toBe(false);
  });

  it('evicts oldest entry when capacity is reached and reports size/clear', () => {
    const cache = new TtlCache<string>(5000, 2);
    cache.set('k1', 'v1', 5000, 100);
    cache.set('k2', 'v2', 5000, 100);
    expect(cache.size).toBe(2);
    cache.set('k3', 'v3', 5000, 100);
    expect(cache.size).toBe(2);
    expect(cache.get('k1', 200)).toBeUndefined();
    expect(cache.get('k2', 200)).toBe('v2');
    expect(cache.get('k3', 200)).toBe('v3');
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('creates deterministic AQI and plan cache keys regardless of household order', () => {
    expect(buildAqiCacheKey(28.6139, 77.209)).toBe('28.61,77.21');
    const key1 = buildPlanCacheKey(
      DEFAULT_LOCATION,
      'unhealthy',
      { ...DEFAULT_PROFILE, household: ['elderly', 'children'] },
      'en',
    );
    const key2 = buildPlanCacheKey(
      DEFAULT_LOCATION,
      'unhealthy',
      { ...DEFAULT_PROFILE, household: ['children', 'elderly'] },
      'en',
    );
    expect(key1).toBe(key2);
  });
});

describe('SlidingWindowRateLimiter', () => {
  it('enforces max requests per minute and recovers after window passes', () => {
    const limiter = new SlidingWindowRateLimiter(3, 60000);
    expect(limiter.consume(1000).allowed).toBe(true);
    expect(limiter.consume(2000).allowed).toBe(true);
    expect(limiter.consume(3000).allowed).toBe(true);

    const blocked = limiter.consume(4000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBe(57000);

    expect(limiter.peekRemaining(4000)).toBe(0);
    expect(limiter.consume(61001).allowed).toBe(true);
    limiter.reset();
    expect(limiter.peekRemaining(61002)).toBe(3);
  });
});
