import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GEOCODING_DEBOUNCE_MS, MIN_SEARCH_QUERY_LENGTH } from '../constants/index.js';
import type { Language, LocationData } from '../types/index.js';
import { validateCityQuery } from '../utils/validation.js';
import {
  applySearchQueryUpdate,
  dispatchCitySubmit,
  runDebouncedSearch,
  type CitySearchSetters,
} from './citySearchHelpers.js';
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

function useDebouncedCitySearchEffect(
  debouncedQuery: string,
  language: Language,
  setters: CitySearchSetters,
): void {
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH || !validateCityQuery(trimmed, language).valid) {
      return;
    }
    const controller = new AbortController();
    void runDebouncedSearch(trimmed, language, controller.signal, setters);
    return (): void => controller.abort();
  }, [debouncedQuery, language, setters]);
}

function useCitySearchState() {
  const [searchQuery, setSearchQueryState] = useState<string>('');
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const setters = useMemo<CitySearchSetters>(
    () => ({
      setResults: setSearchResults,
      setHasSearched,
      setError: setSearchError,
      setIsSearching,
    }),
    [],
  );
  return {
    searchQuery,
    setSearchQueryState,
    searchResults,
    hasSearched,
    isSearching,
    searchError,
    setters,
  };
}

/**
 * Manages debounced city search input, query validation, `AbortController` cleanup,
 * and Enter-key submission for city selection.
 */
export function useCitySearch(
  language: Language,
  onSelectCity: (city: LocationData) => void,
): UseCitySearchReturn {
  const state = useCitySearchState();
  const debouncedQuery = useDebounce(state.searchQuery, GEOCODING_DEBOUNCE_MS);
  const submitAbortRef = useRef<AbortController | null>(null);

  const setSearchQuery = useCallback(
    (val: string): void =>
      applySearchQueryUpdate(val, language, {
        ...state.setters,
        setQueryState: state.setSearchQueryState,
      }),
    [language, state.setSearchQueryState, state.setters],
  );
  const clearSearchInput = useCallback((): void => setSearchQuery(''), [setSearchQuery]);

  useDebouncedCitySearchEffect(debouncedQuery, language, state.setters);
  useEffect(() => () => submitAbortRef.current?.abort(), []);

  const submitCitySearch = useCallback(
    (): Promise<void> =>
      dispatchCitySubmit(
        {
          searchQuery: state.searchQuery,
          searchResults: state.searchResults,
          language,
          submitAbortRef,
        },
        { ...state.setters, onSelectCity },
      ),
    [language, onSelectCity, state.searchQuery, state.searchResults, state.setters],
  );

  return {
    searchQuery: state.searchQuery,
    setSearchQuery,
    searchResults: state.searchResults,
    hasSearched: state.hasSearched,
    isSearching: state.isSearching,
    searchError: state.searchError,
    submitCitySearch,
    clearSearchInput,
  };
}
