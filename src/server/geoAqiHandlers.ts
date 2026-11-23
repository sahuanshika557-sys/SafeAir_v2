import {
  API_TIMEOUT_MS,
  HTTP_BAD_REQUEST,
  HTTP_OK,
  MAX_PLACE_LABEL_LENGTH,
} from '../constants/index.js';
import type { Language } from '../types/index.js';
import { buildAqiCacheKey } from '../utils/cache.js';
import { classifyUpstreamError } from '../utils/errorDiagnostics.js';
import {
  buildOpenMeteoAqiUrl,
  buildOpenMeteoGeocodingUrl,
  buildReverseGeocodingUrl,
  createLinkedTimeoutController,
} from '../utils/network.js';
import { sanitizeTextInput, validateCityQuery } from '../utils/validation.js';
import { getQueryParam, sendJson, type ServerApiRequest, type ServerApiResponse } from './httpUtils.js';
import {
  aqiCache,
  geocodeCache,
  parseValidCoordinates,
  proxyOpenMeteoJson,
  reverseGeocodeCache,
  type ReverseGeocodeCachedValue,
} from './openMeteoProxy.js';
import { runApiRoute } from './routeHelpers.js';
import { bigDataCloudResponseSchema } from './schemas.js';

const REVERSE_GEOCODE_CACHE_HEADER = 'public, s-maxage=3600, stale-while-revalidate=600';
const EMPTY_REVERSE_GEOCODE: ReverseGeocodeCachedValue = {
  resolved: false,
  name: null,
  admin1: '',
  country: '',
};

/**
 * Shared handler for `GET /api/geocode` across Express and Vercel serverless functions.
 */
export async function handleGeocodeRequest(
  req: ServerApiRequest,
  res: ServerApiResponse,
): Promise<void> {
  await runApiRoute(
    req,
    res,
    {
      allowedMethod: 'GET',
      routeLabel: '/api/geocode',
      onError: (category, httpStatus) =>
        sendJson(res, httpStatus, { error: 'Unable to process geocoding request.', category }),
    },
    async () => {
      const rawQuery = getQueryParam(req, 'name');
      const { valid, sanitized } = validateCityQuery(rawQuery);
      if (!valid) {
        sendJson(res, HTTP_BAD_REQUEST, {
          error: 'Invalid city search query.',
          category: 'bad_request',
        });
        return;
      }

      await proxyOpenMeteoJson(
        res,
        buildOpenMeteoGeocodingUrl(sanitized),
        '/api/geocode',
        geocodeCache,
        sanitized.toLowerCase(),
        'Upstream geocoding failed.',
        'Unable to reach geocoding service.',
      );
    },
  );
}

async function fetchReverseGeocodePayload(
  lat: number,
  lon: number,
  langParam: Language,
): Promise<ReverseGeocodeCachedValue> {
  const { controller, cleanup } = createLinkedTimeoutController(API_TIMEOUT_MS);
  try {
    const upstream = await fetch(buildReverseGeocodingUrl(lat, lon, langParam), {
      signal: controller.signal,
    });
    if (!upstream.ok) {
      return EMPTY_REVERSE_GEOCODE;
    }
    const raw: unknown = await upstream.json();
    const parsed = bigDataCloudResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return EMPTY_REVERSE_GEOCODE;
    }
    const primaryName =
      sanitizeTextInput(parsed.data.locality || parsed.data.city, MAX_PLACE_LABEL_LENGTH) ||
      sanitizeTextInput(parsed.data.principalSubdivision, MAX_PLACE_LABEL_LENGTH);
    const admin1 = sanitizeTextInput(parsed.data.principalSubdivision, MAX_PLACE_LABEL_LENGTH);
    const country = sanitizeTextInput(parsed.data.countryName, MAX_PLACE_LABEL_LENGTH);
    return {
      resolved: Boolean(primaryName),
      name: primaryName || null,
      admin1: admin1 === primaryName ? '' : admin1,
      country,
    };
  } catch (err: unknown) {
    const { category, httpStatus } = classifyUpstreamError(err);
    console.error('[SafeAir Saathi] /api/reverse-geocode failed:', {
      category,
      status: httpStatus,
    });
    return EMPTY_REVERSE_GEOCODE;
  } finally {
    cleanup();
  }
}

/**
 * Shared handler for `GET /api/reverse-geocode` resolving coordinates to a city/locality name
 * via a free no-key provider with caching and graceful degradation.
 */
export async function handleReverseGeocodeRequest(
  req: ServerApiRequest,
  res: ServerApiResponse,
): Promise<void> {
  await runApiRoute(
    req,
    res,
    {
      allowedMethod: 'GET',
      routeLabel: '/api/reverse-geocode',
      onError: () => sendJson(res, HTTP_OK, EMPTY_REVERSE_GEOCODE),
    },
    async () => {
      const coords = parseValidCoordinates(
        getQueryParam(req, 'latitude'),
        getQueryParam(req, 'longitude'),
      );
      const langParam: Language = getQueryParam(req, 'language') === 'hi' ? 'hi' : 'en';

      if (!coords) {
        sendJson(res, HTTP_BAD_REQUEST, {
          error: 'Invalid coordinates.',
          category: 'bad_request',
        });
        return;
      }

      const cacheKey = `${buildAqiCacheKey(coords.lat, coords.lon)}:${langParam}`;
      const cached = reverseGeocodeCache.get(cacheKey);
      if (cached) {
        sendJson(res, HTTP_OK, cached, REVERSE_GEOCODE_CACHE_HEADER);
        return;
      }

      const payload = await fetchReverseGeocodePayload(coords.lat, coords.lon, langParam);
      if (payload.resolved) {
        reverseGeocodeCache.set(cacheKey, payload);
        sendJson(res, HTTP_OK, payload, REVERSE_GEOCODE_CACHE_HEADER);
        return;
      }
      sendJson(res, HTTP_OK, payload);
    },
  );
}

/**
 * Shared handler for `GET /api/aqi` across Express and Vercel serverless functions.
 */
export async function handleAqiRequest(
  req: ServerApiRequest,
  res: ServerApiResponse,
): Promise<void> {
  await runApiRoute(
    req,
    res,
    {
      allowedMethod: 'GET',
      routeLabel: '/api/aqi',
      onError: (category, httpStatus) =>
        sendJson(res, httpStatus, { error: 'Unable to fetch air quality.', category }),
    },
    async () => {
      const coords = parseValidCoordinates(
        getQueryParam(req, 'latitude'),
        getQueryParam(req, 'longitude'),
      );
      if (!coords) {
        sendJson(res, HTTP_BAD_REQUEST, {
          error: 'Invalid coordinates.',
          category: 'bad_request',
        });
        return;
      }

      await proxyOpenMeteoJson(
        res,
        buildOpenMeteoAqiUrl(coords.lat, coords.lon),
        '/api/aqi',
        aqiCache,
        buildAqiCacheKey(coords.lat, coords.lon),
        'Upstream air quality lookup failed.',
        'Unable to reach air quality service.',
      );
    },
  );
}
