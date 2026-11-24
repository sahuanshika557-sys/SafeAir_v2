import {
  AQI_CATEGORIES,
  MAX_US_AQI,
  MIN_US_AQI,
  PM25_EPA_BREAKPOINTS,
} from '../constants/index.js';
import type { AirQualityReading, AqiCategoryInfo, Language } from '../types/index.js';

const FALLBACK_HAZARDOUS_CATEGORY: AqiCategoryInfo = AQI_CATEGORIES.at(-1) ?? {
  key: 'hazardous',
  labelEn: 'Hazardous',
  labelHi: 'खतरनाक',
  minAqi: MAX_US_AQI,
  maxAqi: MAX_US_AQI,
  accentHex: '#881337',
  surfaceClass: 'bg-rose-100 dark:bg-rose-950/80',
  textClass: 'text-rose-950 dark:text-rose-100',
  borderClass: 'border-rose-400 dark:border-rose-700',
  summaryEn:
    'Emergency conditions: stay indoors with clean air filtration and monitor symptoms closely.',
  summaryHi: 'आपातकालीन स्थिति: स्वच्छ हवा वाले कमरे में अंदर रहें और लक्षणों पर ध्यान दें।',
};

/**
 * Clamps a numeric US AQI value to valid display bounds `[0, 500]`.
 *
 * @param value - Raw numeric AQI value.
 * @returns Rounded integer AQI clamped between `MIN_US_AQI` and `MAX_US_AQI`.
 */
export function clampAqi(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_US_AQI;
  }
  return Math.max(MIN_US_AQI, Math.min(MAX_US_AQI, Math.round(value)));
}

/**
 * Converts a PM2.5 concentration (µg/m³) to an approximate US EPA AQI when upstream omits `us_aqi`.
 *
 * @param pm25 - Fine particulate concentration in µg/m³.
 * @returns Approximate US EPA AQI integer in `[0, 500]`.
 */
export function pm25ToUsAqi(pm25: number): number {
  const c = Math.max(0, pm25);
  for (const [cLow, cHigh, iLow, iHigh] of PM25_EPA_BREAKPOINTS) {
    if (c <= cHigh) {
      return Math.max(iLow, Math.round(((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow));
    }
  }
  return MAX_US_AQI;
}

/**
 * Maps a US AQI value to its official US EPA category metadata and localized labels.
 *
 * @param aqi - Numeric US AQI score.
 * @returns Matching {@link AqiCategoryInfo} metadata object.
 */
export function getAqiCategory(aqi: number): AqiCategoryInfo {
  const normalized = Math.max(MIN_US_AQI, Math.round(Number.isFinite(aqi) ? aqi : 0));
  return (
    AQI_CATEGORIES.find((category) => normalized <= category.maxAqi) ?? FALLBACK_HAZARDOUS_CATEGORY
  );
}

/**
 * Builds an {@link AirQualityReading} object from a manual AQI entry fallback.
 * Leaves unmeasured pollutants `null` so the UI displays unavailable rather than `0`.
 *
 * @param usAqi - User-entered US AQI value (`0–500`).
 * @returns Normalized manual {@link AirQualityReading}.
 */
export function createManualAirQualityReading(usAqi: number): AirQualityReading {
  const clamped = clampAqi(usAqi);
  return {
    usAqi: clamped,
    pm25: null,
    pm10: null,
    no2: null,
    o3: null,
    timestamp: new Date().toISOString(),
    source: 'manual',
    isManual: true,
    category: getAqiCategory(clamped),
  };
}

/**
 * Formats an ISO timestamp for localized date-time display.
 *
 * @param isoString - ISO-8601 timestamp string.
 * @param language - Target UI locale (`'en'` or `'hi'`).
 * @returns Formatted date-time string, or original input if unparseable.
 */
export function formatAqiTimestamp(isoString: string, language: Language): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
