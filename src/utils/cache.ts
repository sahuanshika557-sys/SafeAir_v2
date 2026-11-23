import { CLIENT_CACHE_MAX_ENTRIES } from '../constants/index.js';
import type { Language, LifestyleProfile, LocationData } from '../types/index.js';

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Bounded in-memory TTL cache for API readings and generated plans.
 */
export class TtlCache<V> {
  private readonly store = new Map<string, CacheEntry<V>>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(defaultTtlMs: number, maxEntries: number = CLIENT_CACHE_MAX_ENTRIES) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
  }

  /**
   * Retrieves a non-expired entry or returns `undefined`.
   *
   * @param key - Cache lookup key.
   * @param now - Optional epoch timestamp in milliseconds for deterministic testing.
   * @returns Cached value if present and unexpired, otherwise `undefined`.
   */
  public get(key: string, now: number = Date.now()): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (now >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Stores a value with the configured TTL, evicting the oldest key when full.
   *
   * @param key - Cache entry key.
   * @param value - Value to cache.
   * @param ttlMs - Optional time-to-live override in milliseconds.
   * @param now - Optional epoch timestamp in milliseconds.
   */
  public set(
    key: string,
    value: V,
    ttlMs: number = this.defaultTtlMs,
    now: number = Date.now(),
  ): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: now + ttlMs,
    });
  }

  /**
   * Checks whether a valid non-expired entry exists.
   *
   * @param key - Cache lookup key.
   * @param now - Optional epoch timestamp in milliseconds.
   * @returns `true` if a non-expired value exists for `key`.
   */
  public has(key: string, now: number = Date.now()): boolean {
    return this.get(key, now) !== undefined;
  }

  /**
   * Removes all cached entries.
   */
  public clear(): void {
    this.store.clear();
  }

  /**
   * Current count of cached entries (before lazy expiration).
   */
  public get size(): number {
    return this.store.size;
  }
}

/**
 * Creates a stable cache key for AQI coordinate lookups rounded to 2 decimal places.
 *
 * @param latitude - Geographic latitude in decimal degrees.
 * @param longitude - Geographic longitude in decimal degrees.
 * @returns Normalized coordinate cache key string.
 */
export function buildAqiCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

/**
 * Creates a deterministic cache key for a generated action plan.
 *
 * @param location - Selected location data.
 * @param aqiBucket - AQI severity category key.
 * @param profile - Household lifestyle profile.
 * @param language - Target UI language (`'en'` or `'hi'`).
 * @returns Deterministic JSON cache key string.
 */
export function buildPlanCacheKey(
  location: LocationData,
  aqiBucket: string,
  profile: LifestyleProfile,
  language: Language,
): string {
  const sortedHousehold = [...profile.household].toSorted((a, b) => a.localeCompare(b)).join(',');
  return JSON.stringify({
    loc: buildAqiCacheKey(location.latitude, location.longitude),
    aqiBucket,
    language,
    household: sortedHousehold,
    commuteMode: profile.commuteMode,
    workStyle: profile.workStyle,
    homeType: profile.homeType,
    hasAirPurifier: profile.hasAirPurifier,
    cookingFuel: profile.cookingFuel,
    budget: profile.budget,
    notes: profile.notes.trim(),
  });
}
