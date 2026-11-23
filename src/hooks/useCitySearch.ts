import { useCallback, useEffect, useRef, useState } from 'react';
import { GEOCODING_DEBOUNCE_MS, MIN_SEARCH_QUERY_LENGTH } from '../constants/index.js';
import { searchCities } from '../services/geocoding.js';
import type { Language, LocationData } from '../types/index.js';
import { isAbortError } from '../utils/network.js';
import { validateCityQuery } from '../utils/validation.js';
import { resolveCitySearchErrorMessage } from './airQualityHelpers.js';
import { useDebounce } from './useDebounce.js';

/** State and actions returned by {@link useCitySearch}. */
export interface UseCitySearchReturn {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchResults: LocationData[];
  hasSearched: boolean;
  isSearching: boolean;
  searchError: string | null;
  submitCitySearch: () => Promise<void>;
  clearSearchInput: () => void;
}

async function runDebouncedSearch(
  query: string,
  language: Language,
  signal: AbortSignal,
  handlers: {
    setResults: (cities: LocationData[]) => void;
    setHasSearched: (val: boolean) => void;
    setError: (msg: string | null) => void;
    setIsSearching: (val: boolean) => void;
  },
): Promise<void> {
  try {
    const cities = await searchCities(query, signal, language);
    if (!signal.aborted) {
      handlers.setResults(cities);
      handlers.setHasSearched(true);
    }
  } catch (err: unknown) {
    if (!isAbortError(err) && !signal.aborted) {
      handlers.setResults([]);
      handlers.setHasSearched(true);
      handlers.setError(resolveCitySearchErrorMessage(err, language));
    }
  } finally {
    if (!signal.aborted) {
      handlers.setIsSearching(false);
    }
  }
}

async function runSubmitSearch(
  query: string,
  language: Language,
  signal: AbortSignal,
  handlers: {
    setResults: (cities: LocationData[]) => void;
    setHasSearched: (val: boolean) => void;
    setError: (msg: string | null) => void;
    setIsSearching: (val: boolean) => void;
    onSelectCity: (city: LocationData) => void;
  },
): Promise<void> {
  handlers.setIsSearching(true);
  handlers.setError(null);
  try {
    const cities = await searchCities(query, signal, language);
    if (!signal.aborted) {
      handlers.setResults(cities);
      handlers.setHasSearched(true);
      if (cities[0]) {
        handlers.onSelectCity(cities[0]);
      }
    }
  } catch (err: unknown) {
    if (!isAbortError(err) && !signal.aborted) {
      handlers.setError(resolveCitySearchErrorMessage(err, language));
    }
  } finally {
    if (!signal.aborted) {
      handlers.setIsSearching(false);
    }
  }
}

function applySearchQueryUpdate(
  value: string,
  language: Language,
  setters: {
    setQueryState: (val: string) => void;
    setResults: (cities: LocationData[]) => void;
    setHasSearched: (val: boolean) => void;
    setError: (msg: string | null) => void;
    setIsSearching: (val: boolean) => void;
  },
): void {
  setters.setQueryState(value);
  const trimmed = value.trim();
  const validShort = trimmed.length >= MIN_SEARCH_QUERY_LENGTH;
  const validation = validShort ? validateCityQuery(trimmed, language) : undefined;
  if (!validShort || !validation?.valid) {
    setters.setResults([]);
    setters.setHasSearched(false);
    setters.setError(validation?.error ?? null);
    setters.setIsSearching(false);
    return;
  }
  setters.setError(null);
  setters.setIsSearching(true);
}

async function dispatchCitySubmit(
  params: {
    searchQuery: string;
    searchResults: LocationData[];
    language: Language;
    submitAbortRef: React.RefObject<AbortController | null>;
  },
  handlers: {
    setResults: (cities: LocationData[]) => void;
    setHasSearched: (val: boolean) => void;
    setError: (msg: string | null) => void;
    setIsSearching: (val: boolean) => void;
    onSelectCity: (city: LocationData) => void;
  },
): Promise<void> {
  const trimmed = params.searchQuery.trim();
  const validation = validateCityQuery(trimmed, params.language);
  if (!validation.valid) {
    handlers.setError(validation.error ?? null);
    return;
  }
  if (params.searchResults[0]) {
    handlers.onSelectCity(params.searchResults[0]);
    return;
  }
  params.submitAbortRef.current?.abort();
  const controller = new AbortController();
  params.submitAbortRef.current = controller;
  await runSubmitSearch(trimmed, params.language, controller.signal, handlers);
}

/**
 * Manages debounced city search input, query validation, `AbortController` cleanup,
 * and Enter-key submission for city selection.
 */
export function useCitySearch(
  language: Language,
  onSelectCity: (city: LocationData) => void,
): UseCitySearchReturn {
  const [searchQuery, setSearchQueryState] = useState<string>('');
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debouncedQuery = useDebounce(searchQuery, GEOCODING_DEBOUNCE_MS);
  const submitAbortRef = useRef<AbortController | null>(null);

  const setSearchQuery = useCallback(
    (value: string): void =>
      applySearchQueryUpdate(value, language, {
        setQueryState: setSearchQueryState, setResults: setSearchResults, setHasSearched, setError: setSearchError, setIsSearching,
      }),
    [language],
  );
  const clearSearchInput = useCallback((): void => setSearchQuery(''), [setSearchQuery]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH || !validateCityQuery(trimmed, language).valid) {
      return;
    }
    const controller = new AbortController();
    void runDebouncedSearch(trimmed, language, controller.signal, {
      setResults: setSearchResults, setHasSearched, setError: setSearchError, setIsSearching,
    });
    return (): void => controller.abort();
  }, [debouncedQuery, language]);

  useEffect(() => () => submitAbortRef.current?.abort(), []);

  const submitCitySearch = useCallback(
    (): Promise<void> =>
      dispatchCitySubmit(
        { searchQuery, searchResults, language, submitAbortRef },
        { setResults: setSearchResults, setHasSearched, setError: setSearchError, setIsSearching, onSelectCity },
      ),
    [language, onSelectCity, searchQuery, searchResults],
  );

  return { searchQuery, setSearchQuery, searchResults, hasSearched, isSearching, searchError, submitCitySearch, clearSearchInput };
}
