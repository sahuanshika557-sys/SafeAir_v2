import {
  GEOCODING_SEARCH_COUNT,
  OPEN_METEO_AQI_URL,
  OPEN_METEO_GEOCODING_URL,
  REVERSE_GEOCODING_URL,
} from '../constants/index.js';
import type { Language } from '../types/index.js';

const COORD_PRECISION = 4;

/**
 * Linked timeout controller returned by {@link createLinkedTimeoutController}.
 */
export interface LinkedTimeoutController {
  controller: AbortController;
  cleanup: () => void;
}

/**
 * Determines whether an unknown thrown value represents an aborted request (`AbortError`).
 *
 * @param err - Caught error or rejection value.
 * @returns `true` if the error is an `AbortError`, otherwise `false`.
 */
export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return true;
  }
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Creates an `AbortController` bounded by a timeout and optionally linked to an external `AbortSignal`.
 * Throws an `AbortError` immediately if `externalSignal` is already aborted.
 *
 * @param timeoutMs - Maximum request duration in milliseconds before aborting.
 * @param externalSignal - Optional caller signal whose abort cancels this controller.
 * @returns An object containing the linked `controller` and a `cleanup` function to release timers and listeners.
 */
export function createLinkedTimeoutController(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): LinkedTimeoutController {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = (): void => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      globalThis.clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const cleanup = (): void => {
    globalThis.clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  };

  return { controller, cleanup };
}

/**
 * Builds the Open-Meteo Geocoding API URL for a sanitized city search query.
 *
 * @param sanitizedQuery - Pre-validated city name or search term.
 * @returns Fully formatted Open-Meteo Geocoding request URL.
 */
export function buildOpenMeteoGeocodingUrl(sanitizedQuery: string): string {
  const url = new URL(OPEN_METEO_GEOCODING_URL);
  url.searchParams.set('name', sanitizedQuery);
  url.searchParams.set('count', GEOCODING_SEARCH_COUNT);
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  return url.toString();
}

/**
 * Builds the Open-Meteo Air Quality API URL requesting US AQI, PM2.5, PM10, NO2, and O3.
 *
 * @param latitude - Geographic latitude in decimal degrees.
 * @param longitude - Geographic longitude in decimal degrees.
 * @returns Fully formatted Open-Meteo Air Quality request URL.
 */
export function buildOpenMeteoAqiUrl(latitude: number, longitude: number): string {
  const url = new URL(OPEN_METEO_AQI_URL);
  url.searchParams.set('latitude', latitude.toFixed(COORD_PRECISION));
  url.searchParams.set('longitude', longitude.toFixed(COORD_PRECISION));
  url.searchParams.set('current', 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone');
  url.searchParams.set('timezone', 'auto');
  return url.toString();
}

/**
 * Builds the free no-key reverse geocoding URL (BigDataCloud) called server-side.
 *
 * @param latitude - Geographic latitude in decimal degrees.
 * @param longitude - Geographic longitude in decimal degrees.
 * @param language - Requested locality display language (`'en'` or `'hi'`).
 * @returns Formatted reverse geocoding URL.
 */
export function buildReverseGeocodingUrl(
  latitude: number,
  longitude: number,
  language: Language = 'en',
): string {
  const url = new URL(REVERSE_GEOCODING_URL);
  url.searchParams.set('latitude', latitude.toFixed(COORD_PRECISION));
  url.searchParams.set('longitude', longitude.toFixed(COORD_PRECISION));
  url.searchParams.set('localityLanguage', language);
  return url.toString();
}

async function fetchJson(
  targetUrl: string,
  signal: AbortSignal,
  serviceLabel: string,
): Promise<unknown> {
  const response = await fetch(targetUrl, {
    method: 'GET',
    signal,
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) {
    throw new Error(`${serviceLabel} returned HTTP ${response.status}.`);
  }
  return response.json();
}

/**
 * Fetches JSON from a direct upstream URL and falls back to a server proxy URL on non-abort errors.
 *
 * @param directUrl - Primary upstream HTTPS endpoint.
 * @param proxyUrl - Same-origin server proxy fallback endpoint.
 * @param signal - AbortSignal controlling request cancellation and timeout.
 * @param serviceLabel - Short service name used in HTTP error messages.
 * @returns Parsed JSON payload from either the direct endpoint or proxy fallback.
 */
export async function fetchJsonWithProxyFallback(
  directUrl: string,
  proxyUrl: string,
  signal: AbortSignal,
  serviceLabel: string,
): Promise<unknown> {
  try {
    return await fetchJson(directUrl, signal, serviceLabel);
  } catch (directErr: unknown) {
    if (isAbortError(directErr)) {
      throw directErr;
    }
    return fetchJson(proxyUrl, signal, serviceLabel);
  }
}
