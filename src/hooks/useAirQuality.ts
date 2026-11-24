import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LOCATION } from '../constants/index.js';
import type { AirQualityReading, Language, LocationData } from '../types/index.js';
import { createManualAirQualityReading } from '../utils/aqi.js';
import { validateManualAqi } from '../utils/validation.js';
import { executeCoordinateLoad, useAqiLoader } from './useAqiLoader.js';
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

function applyValidatedManualAqi(
  value: number,
  language: Language,
  setReading: (r: AirQualityReading) => void,
  setAqiError: (e: string | null) => void,
  setIsLoadingAqi: (l: boolean) => void,
): { success: boolean; error?: string } {
  const parsed = validateManualAqi(value, language);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }
  setReading(createManualAirQualityReading(parsed.data));
  setAqiError(null);
  setIsLoadingAqi(false);
  return { success: true };
}

function useAqiState() {
  const [location, setLocation] = useState<LocationData>(DEFAULT_LOCATION);
  const [reading, setReading] = useState<AirQualityReading | null>(null);
  const [isLoadingAqi, setIsLoadingAqi] = useState<boolean>(true);
  const [aqiError, setAqiError] = useState<string | null>(null);
  const setters = useMemo(
    () => ({ setLocation, setReading, setError: setAqiError, setLoading: setIsLoadingAqi }),
    [],
  );
  return { location, reading, isLoadingAqi, aqiError, setters };
}

function useAqiActions(
  language: Language,
  location: LocationData,
  setters: ReturnType<typeof useAqiState>['setters'],
  clearSearchInput: () => void,
  loadAqiForLocation: (target: LocationData, bypassCache?: boolean) => Promise<void>,
) {
  const loadByCoordinates = useCallback(
    (lat: number, lon: number, label?: string): Promise<void> =>
      executeCoordinateLoad(
        { latitude: lat, longitude: lon, label, language },
        { setLocation: setters.setLocation, clearSearchInput, loadAqiForLocation },
      ),
    [clearSearchInput, language, loadAqiForLocation, setters],
  );
  const applyManualAqi = useCallback(
    (val: number) =>
      applyValidatedManualAqi(
        val,
        language,
        setters.setReading,
        setters.setError,
        setters.setLoading,
      ),
    [language, setters],
  );
  const refreshAqi = useCallback(
    (): void => void loadAqiForLocation(location, true),
    [loadAqiForLocation, location],
  );
  return { loadByCoordinates, applyManualAqi, refreshAqi };
}

/**
 * Coordinates live AQI fetching, `AbortController` request cancellation, city search,
 * reverse geocoding for browser coordinates, and manual AQI fallback.
 */
export function useAirQuality(language: Language = 'en'): UseAirQualityReturn {
  const { location, reading, isLoadingAqi, aqiError, setters } = useAqiState();
  const clearSearchRef = useRef<() => void>(() => {});
  const loadAqiForLocation = useAqiLoader(language, setters);
  const selectCity = useCallback(
    (city: LocationData): void => {
      setters.setLocation(city);
      clearSearchRef.current();
      void loadAqiForLocation(city, true);
    },
    [loadAqiForLocation, setters],
  );
  const citySearch = useCitySearch(language, selectCity);
  useEffect(() => {
    clearSearchRef.current = citySearch.clearSearchInput;
  }, [citySearch.clearSearchInput]);
  const actions = useAqiActions(
    language,
    location,
    setters,
    citySearch.clearSearchInput,
    loadAqiForLocation,
  );
  return { location, reading, isLoadingAqi, aqiError, ...citySearch, selectCity, ...actions };
}
