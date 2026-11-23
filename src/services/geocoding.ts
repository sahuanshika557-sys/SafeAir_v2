import { z } from 'zod';
import {
  API_TIMEOUT_MS,
  CLIENT_CACHE_MAX_ENTRIES,
  REVERSE_GEOCODE_CACHE_TTL_MS,
  REVERSE_GEOCODE_TIMEOUT_MS,
} from '../constants/index.js';
import type { Language, LocationData } from '../types/index.js';
import { buildAqiCacheKey, TtlCache } from '../utils/cache.js';
import {
  buildOpenMeteoGeocodingUrl,
  createLinkedTimeoutController,
  fetchJsonWithProxyFallback,
  isAbortError,
} from '../utils/network.js';
import { geocodingResponseSchema, validateCityQuery } from '../utils/validation.js';

const COORD_PRECISION_DECIMALS = 4;

const reverseGeocodeProxyResponseSchema = z.object({
  resolved: z.boolean().optional(),
  name: z.string().nullable().optional(),
  admin1: z.string().optional(),
  country: z.string().optional(),
});

const reverseGeocodeCache = new TtlCache<{
  name: string;
  admin1?: string;
  country: string;
}>(REVERSE_GEOCODE_CACHE_TTL_MS, CLIENT_CACHE_MAX_ENTRIES);

/**
 * Clears the client-side reverse geocoding cache (intended for tests).
 */
export function clearReverseGeocodeCache(): void {
  reverseGeocodeCache.clear();
}

function normalizeCitySearchError(err: unknown, language: Language): Error {
  if (isAbortError(err)) {
    return err instanceof Error ? err : new DOMException('Aborted', 'AbortError');
  }
  return new Error(
    language === 'hi'
      ? 'अभी शहर खोजे नहीं जा सके। कृपया अपना इंटरनेट जांचें या अपना स्थान उपयोग करें।'
      : 'Unable to search cities right now. Please check your connection or use your location.',
    { cause: err },
  );
}

/**
 * Searches matching cities via Open-Meteo Geocoding API with automatic `/api/geocode`
 * server proxy fallback when direct browser requests are blocked.
 */
export async function searchCities(
  rawQuery: string,
  externalSignal?: AbortSignal,
  language: Language = 'en',
): Promise<LocationData[]> {
  const { valid, sanitized } = validateCityQuery(rawQuery, language);
  if (!valid) {
    return [];
  }
  const { controller, cleanup } = createLinkedTimeoutController(API_TIMEOUT_MS, externalSignal);
  try {
    const directUrl = buildOpenMeteoGeocodingUrl(sanitized);
    const json = await fetchJsonWithProxyFallback(
      directUrl,
      `/api/geocode?name=${encodeURIComponent(sanitized)}`,
      controller.signal,
      'Geocoding service',
    );
    const parsed = geocodingResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error('Geocoding service returned an unexpected response format.');
    }
    return parsed.data.results.map((item) => ({
      id: `city-${item.id}`,
      name: item.name,
      admin1: item.admin1,
      country: item.country,
      latitude: item.latitude,
      longitude: item.longitude,
      source: 'search',
    }));
  } catch (err: unknown) {
    throw normalizeCitySearchError(err, language);
  } finally {
    cleanup();
  }
}

function parseReverseGeocodePayload(
  rawJson: unknown,
): { name: string; admin1?: string; country: string } | null {
  const parsed = reverseGeocodeProxyResponseSchema.safeParse(rawJson);
  if (!parsed.success || !parsed.data.resolved || !parsed.data.name) {
    return null;
  }
  return {
    name: parsed.data.name,
    ...(parsed.data.admin1 ? { admin1: parsed.data.admin1 } : {}),
    country: parsed.data.country ?? '',
  };
}

/**
 * Resolves browser geolocation coordinates into a human-readable locality/city name via the
 * server-side `/api/reverse-geocode` proxy with caching and graceful `null` fallback.
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
  language: Language = 'en',
  externalSignal?: AbortSignal,
): Promise<{ name: string; admin1?: string; country: string } | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const cacheKey = `${buildAqiCacheKey(latitude, longitude)}:${language}`;
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const { controller, cleanup } = createLinkedTimeoutController(REVERSE_GEOCODE_TIMEOUT_MS, externalSignal);
  try {
    const latStr = encodeURIComponent(latitude.toFixed(COORD_PRECISION_DECIMALS));
    const lonStr = encodeURIComponent(longitude.toFixed(COORD_PRECISION_DECIMALS));
    const url = `/api/reverse-geocode?latitude=${latStr}&longitude=${lonStr}&language=${language}`;
    const response = await fetch(url, { method: 'GET', signal: controller.signal, referrerPolicy: 'no-referrer' });
    const result = response.ok ? parseReverseGeocodePayload(await response.json()) : null;
    if (result) {
      reverseGeocodeCache.set(cacheKey, result);
    }
    return result;
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw err;
    }
    return null;
  } finally {
    cleanup();
  }
}
