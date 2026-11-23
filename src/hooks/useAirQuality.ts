import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_LOCATION } from '../constants/index.js';
import { fetchAirQuality } from '../services/airQuality.js';
import { reverseGeocodeCoordinates } from '../services/geocoding.js';
import type { AirQualityReading, Language, LocationData } from '../types/index.js';
import { createManualAirQualityReading } from '../utils/aqi.js';
import { isAbortError } from '../utils/network.js';
import { validateManualAqi } from '../utils/validation.js';
import {
  buildGeolocationLocation,
  isSameGeoCoordinateLocation,
  resolveAqiErrorMessage,
} from './airQualityHelpers.js';
import { useCitySearch } from './useCitySearch.js';

/** State and actions returned by {@link useAirQuality}. */
export interface UseAirQualityReturn {
  location: LocationData;
  reading: AirQualityReading | null;
  isLoadingAqi: boolean;
  aqiError: string | null;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchResults: LocationData[];
  hasSearched: boolean;
  isSearching: boolean;
  searchError: string | null;
  selectCity: (city: LocationData) => void;
  submitCitySearch: () => Promise<void>;
  loadByCoordinates: (latitude: number, longitude: number, label?: string) => Promise<void>;
  applyManualAqi: (value: number) => { success: boolean; error?: string };
  refreshAqi: () => void;
}

async function runAqiFetch(
  target: LocationData,
  bypassCache: boolean,
  language: Language,
  signal: AbortSignal,
  handlers: {
    setReading: (r: AirQualityReading) => void;
    setError: (e: string | null) => void;
    setLoading: (l: boolean) => void;
  },
): Promise<void> {
  handlers.setLoading(true);
  handlers.setError(null);
  try {
    const nextReading = await fetchAirQuality(target.latitude, target.longitude, {
      bypassCache,
      signal,
      language,
    });
    if (!signal.aborted) {
      handlers.setReading(nextReading);
    }
  } catch (err: unknown) {
    if (!isAbortError(err) && !signal.aborted) {
      handlers.setError(resolveAqiErrorMessage(err, language));
    }
  } finally {
    if (!signal.aborted) {
      handlers.setLoading(false);
    }
  }
}

async function resolveGeoCityLabel(
  latitude: number,
  longitude: number,
  language: Language,
  setLocation: React.Dispatch<React.SetStateAction<LocationData>>,
): Promise<void> {
  const resolvedPlace = await reverseGeocodeCoordinates(latitude, longitude, language).catch(() => null);
  if (!resolvedPlace) {
    return;
  }
  setLocation((prev) =>
    isSameGeoCoordinateLocation(prev, latitude, longitude)
      ? { ...prev, name: resolvedPlace.name, admin1: resolvedPlace.admin1, country: resolvedPlace.country }
      : prev,
  );
}

async function executeCoordinateLoad(
  params: {
    latitude: number;
    longitude: number;
    label?: string;
    language: Language;
  },
  deps: {
    setLocation: React.Dispatch<React.SetStateAction<LocationData>>;
    clearSearchInput: () => void;
    loadAqiForLocation: (target: LocationData, bypassCache?: boolean) => Promise<void>;
  },
): Promise<void> {
  const { latitude, longitude, label, language } = params;
  const initialLoc = buildGeolocationLocation(latitude, longitude, language, label);
  deps.setLocation(initialLoc);
  deps.clearSearchInput();
  if (label) {
    await deps.loadAqiForLocation(initialLoc, true);
    return;
  }
  await Promise.all([
    resolveGeoCityLabel(latitude, longitude, language, deps.setLocation),
    deps.loadAqiForLocation(initialLoc, true),
  ]);
}

function useAqiLoader(
  language: Language,
  handlers: {
    setReading: (r: AirQualityReading) => void;
    setError: (e: string | null) => void;
    setLoading: (l: boolean) => void;
  },
): (target: LocationData, bypassCache?: boolean) => Promise<void> {
  const aqiAbortRef = useRef<AbortController | null>(null);
  const languageRef = useRef<Language>(language);
  const { setReading, setError, setLoading } = handlers;

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    aqiAbortRef.current = controller;
    void runAqiFetch(DEFAULT_LOCATION, false, languageRef.current, controller.signal, {
      setReading,
      setError,
      setLoading,
    });
    return (): void => {
      controller.abort();
      aqiAbortRef.current?.abort();
    };
  }, [setError, setLoading, setReading]);

  return useCallback(
    async (target: LocationData, bypassCache: boolean = false): Promise<void> => {
      aqiAbortRef.current?.abort();
      const controller = new AbortController();
      aqiAbortRef.current = controller;
      await runAqiFetch(target, bypassCache, language, controller.signal, {
        setReading,
        setError,
        setLoading,
      });
    },
    [language, setError, setLoading, setReading],
  );
}

/**
 * Coordinates live AQI fetching, `AbortController` request cancellation, city search,
 * reverse geocoding for browser coordinates, and manual AQI fallback.
 */
export function useAirQuality(language: Language = 'en'): UseAirQualityReturn {
  const [location, setLocation] = useState<LocationData>(DEFAULT_LOCATION);
  const [reading, setReading] = useState<AirQualityReading | null>(null);
  const [isLoadingAqi, setIsLoadingAqi] = useState<boolean>(true);
  const [aqiError, setAqiError] = useState<string | null>(null);
  const clearSearchRef = useRef<() => void>(() => {});
  const loadAqiForLocation = useAqiLoader(language, { setReading, setError: setAqiError, setLoading: setIsLoadingAqi });

  const selectCity = useCallback(
    (city: LocationData): void => {
      setLocation(city);
      clearSearchRef.current();
      void loadAqiForLocation(city, true);
    },
    [loadAqiForLocation],
  );

  const citySearch = useCitySearch(language, selectCity);
  useEffect(() => {
    clearSearchRef.current = citySearch.clearSearchInput;
  }, [citySearch.clearSearchInput]);

  const loadByCoordinates = useCallback(
    (latitude: number, longitude: number, label?: string): Promise<void> =>
      executeCoordinateLoad({ latitude, longitude, label, language }, { setLocation, clearSearchInput: citySearch.clearSearchInput, loadAqiForLocation }),
    [citySearch.clearSearchInput, language, loadAqiForLocation],
  );

  const applyManualAqi = useCallback(
    (value: number): { success: boolean; error?: string } => {
      const parsed = validateManualAqi(value, language);
      if (!parsed.success) {
        return { success: false, error: parsed.error };
      }
      setReading(createManualAirQualityReading(parsed.data));
      setAqiError(null);
      setIsLoadingAqi(false);
      return { success: true };
    },
    [language],
  );

  const refreshAqi = useCallback((): void => void loadAqiForLocation(location, true), [loadAqiForLocation, location]);

  return { location, reading, isLoadingAqi, aqiError, ...citySearch, selectCity, loadByCoordinates, applyManualAqi, refreshAqi };
}
