import {
  API_TIMEOUT_MS,
  AQI_CACHE_TTL_MS,
  HTTP_BAD_GATEWAY,
  HTTP_OK,
  MAX_LATITUDE,
  MAX_LONGITUDE,
  MIN_LATITUDE,
  MIN_LONGITUDE,
  REVERSE_GEOCODE_CACHE_TTL_MS,
  SERVER_PROXY_CACHE_MAX_ENTRIES,
} from '../constants/index.js';
import { TtlCache } from '../utils/cache.js';
import { classifyUpstreamError } from '../utils/errorDiagnostics.js';
import { createLinkedTimeoutController } from '../utils/network.js';
import { sendJson, type ServerApiResponse } from './httpUtils.js';

const UPSTREAM_ERROR_STATUS_MIN = 400;
const UPSTREAM_ERROR_STATUS_MAX = 599;

/** Cached reverse-geocoded place result shape. */
export interface ReverseGeocodeCachedValue {
  resolved: boolean;
  name: string | null;
  admin1: string;
  country: string;
}

/** Bounded server-side TTL cache for Open-Meteo geocoding responses. */
export const geocodeCache = new TtlCache<unknown>(AQI_CACHE_TTL_MS, SERVER_PROXY_CACHE_MAX_ENTRIES);

/** Bounded server-side TTL cache for Open-Meteo air quality responses. */
export const aqiCache = new TtlCache<unknown>(AQI_CACHE_TTL_MS, SERVER_PROXY_CACHE_MAX_ENTRIES);

/** Bounded server-side TTL cache for reverse geocoding responses. */
export const reverseGeocodeCache = new TtlCache<ReverseGeocodeCachedValue>(
  REVERSE_GEOCODE_CACHE_TTL_MS,
  SERVER_PROXY_CACHE_MAX_ENTRIES,
);

/**
 * Clears server-side geocode, AQI, and reverse-geocode TTL caches (intended for tests).
 */
export function resetServerCaches(): void {
  geocodeCache.clear();
  aqiCache.clear();
  reverseGeocodeCache.clear();
}

/**
 * Parses and validates geographic coordinate strings within standard WGS84 bounds.
 *
 * @param latParam - Latitude query string.
 * @param lonParam - Longitude query string.
 * @returns Validated `{ lat, lon }` pair or `null` when out of bounds or non-numeric.
 */
export function parseValidCoordinates(
  latParam: string,
  lonParam: string,
): { lat: number; lon: number } | null {
  const lat = latParam ? Number(latParam) : Number.NaN;
  const lon = lonParam ? Number(lonParam) : Number.NaN;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < MIN_LATITUDE ||
    lat > MAX_LATITUDE ||
    lon < MIN_LONGITUDE ||
    lon > MAX_LONGITUDE
  ) {
    return null;
  }
  return { lat, lon };
}

/**
 * Proxies an Open-Meteo GET JSON endpoint with bounded TTL caching and CDN cache headers.
 */
export async function proxyOpenMeteoJson(
  res: ServerApiResponse,
  targetUrl: string,
  routeLabel: '/api/geocode' | '/api/aqi',
  cache: TtlCache<unknown>,
  cacheKey: string,
  upstreamFailMessage: string,
  unreachableMessage: string,
): Promise<void> {
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    sendJson(res, HTTP_OK, cached, 'public, s-maxage=300, stale-while-revalidate=60');
    return;
  }

  const { controller, cleanup } = createLinkedTimeoutController(API_TIMEOUT_MS);
  try {
    const upstream = await fetch(targetUrl, { signal: controller.signal });
    if (!upstream.ok) {
      const status =
        upstream.status >= UPSTREAM_ERROR_STATUS_MIN && upstream.status <= UPSTREAM_ERROR_STATUS_MAX
          ? upstream.status
          : HTTP_BAD_GATEWAY;
      console.error(`[SafeAir Saathi] ${routeLabel} upstream status:`, { status });
      sendJson(res, status, { error: upstreamFailMessage, category: 'upstream_error' });
      return;
    }
    const data: unknown = await upstream.json();
    cache.set(cacheKey, data);
    sendJson(res, HTTP_OK, data, 'public, s-maxage=300, stale-while-revalidate=60');
  } catch (err: unknown) {
    const { category, httpStatus } = classifyUpstreamError(err);
    console.error(`[SafeAir Saathi] ${routeLabel} failed:`, { category, status: httpStatus });
    sendJson(res, httpStatus, { error: unreachableMessage, category });
  } finally {
    cleanup();
  }
}
