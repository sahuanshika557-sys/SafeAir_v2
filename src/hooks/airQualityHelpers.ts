import { COORDINATE_MATCH_EPSILON } from '../constants/index.js';
import type { Language, LocationData } from '../types/index.js';

const COORD_LABEL_DECIMALS = 2;

/** Returns localized AQI fetch failure text. */
export function resolveAqiErrorMessage(err: unknown, language: Language): string {
  if (err instanceof Error) {
    return err.message;
  }
  return language === 'hi'
    ? 'अभी लाइव वायु गुणवत्ता डेटा प्राप्त नहीं हो सका।'
    : 'Unable to fetch live air quality right now.';
}

/** Returns localized city search failure text. */
export function resolveCitySearchErrorMessage(err: unknown, language: Language): string {
  if (err instanceof Error) {
    return err.message;
  }
  return language === 'hi' ? 'शहर खोज विफल रही।' : 'City search failed.';
}

/** Builds a temporary fallback location label for browser geolocation coordinates. */
export function buildGeolocationLocation(
  latitude: number,
  longitude: number,
  language: Language,
  label?: string,
): LocationData {
  const fallbackLabel =
    language === 'hi'
      ? `वर्तमान स्थान (${latitude.toFixed(COORD_LABEL_DECIMALS)}, ${longitude.toFixed(COORD_LABEL_DECIMALS)})`
      : `Current Location (${latitude.toFixed(COORD_LABEL_DECIMALS)}, ${longitude.toFixed(COORD_LABEL_DECIMALS)})`;
  return {
    id: 'geo-current',
    name: label ?? fallbackLabel,
    country: '',
    latitude,
    longitude,
    source: 'geolocation',
  };
}

/** Checks whether the active location still corresponds to the coordinates just reverse-geocoded. */
export function isSameGeoCoordinateLocation(
  location: LocationData,
  latitude: number,
  longitude: number,
): boolean {
  return (
    location.id === 'geo-current' &&
    Math.abs(location.latitude - latitude) < COORDINATE_MATCH_EPSILON &&
    Math.abs(location.longitude - longitude) < COORDINATE_MATCH_EPSILON
  );
}
