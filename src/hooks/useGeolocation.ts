import { useCallback, useState } from 'react';
import { API_TIMEOUT_MS } from '../constants/index.js';
import type { Language } from '../types/index.js';

/**
 * Geographic coordinates returned by {@link useGeolocation}.
 */
export interface GeolocationResult {
  latitude: number;
  longitude: number;
}

/**
 * State and actions returned by {@link useGeolocation}.
 */
export interface UseGeolocationReturn {
  isLocating: boolean;
  error: string | null;
  requestLocation: () => Promise<GeolocationResult | null>;
  clearError: () => void;
}

function getGeoUnsupportedMessage(language: Language): string {
  return language === 'hi'
    ? 'आपके ब्राउज़र में लोकेशन सेवा समर्थित नहीं है। शहर खोजें या मैनुअल AQI दर्ज करें।'
    : 'Geolocation is not supported by your browser. Search a city or enter AQI manually.';
}

function getGeoErrorMessage(geoErr: GeolocationPositionError, language: Language): string {
  if (geoErr.code === geoErr.PERMISSION_DENIED) {
    return language === 'hi'
      ? 'लोकेशन अनुमति अस्वीकार की गई। कृपया अपना शहर खोजें या मैनुअल AQI दर्ज करें।'
      : 'Location permission denied. Search for your city or enter AQI manually.';
  }
  if (geoErr.code === geoErr.TIMEOUT) {
    return language === 'hi'
      ? 'लोकेशन खोजने का समय समाप्त हो गया। कृपया अपना शहर खोजें।'
      : 'Location lookup timed out. Please search for your city instead.';
  }
  return language === 'hi'
    ? 'आपका स्थान प्राप्त नहीं हो सका। कृपया अपना शहर खोजें।'
    : 'Unable to determine your location. Please search for your city.';
}

/**
 * Requests browser geolocation strictly on explicit user action without persisting coordinates.
 *
 * @param language - UI language used for localized permission and timeout error messages.
 * @returns Geolocation lookup state, localized error message, and trigger/clear handlers.
 */
export function useGeolocation(language: Language = 'en'): UseGeolocationReturn {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback((): void => setError(null), []);

  const requestLocation = useCallback((): Promise<GeolocationResult | null> => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(getGeoUnsupportedMessage(language));
      return Promise.resolve(null);
    }

    setIsLocating(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsLocating(false);
          resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        },
        (geoErr) => {
          setIsLocating(false);
          setError(getGeoErrorMessage(geoErr, language));
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: API_TIMEOUT_MS, maximumAge: 0 },
      );
    });
  }, [language]);

  return { isLocating, error, requestLocation, clearError };
}
