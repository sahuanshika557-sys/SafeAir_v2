import type { RefObject } from 'react';
import { MIN_SEARCH_QUERY_LENGTH } from '../constants/index.js';
import { searchCities } from '../services/geocoding.js';
import type { Language, LocationData } from '../types/index.js';
import { isAbortError } from '../utils/network.js';
import { validateCityQuery } from '../utils/validation.js';
import { resolveCitySearchErrorMessage } from './airQualityHelpers.js';

/** Setter callbacks shared by debounced and submitted city search helpers. */
export interface CitySearchSetters {
  setResults: (cities: LocationData[]) => void;
  setHasSearched: (val: boolean) => void;
  setError: (msg: string | null) => void;
  setIsSearching: (val: boolean) => void;
}

/** Runs debounced geocoding search and handles abort-safe result or error updates. */
export async function runDebouncedSearch(
  query: string,
  language: Language,
  signal: AbortSignal,
  handlers: CitySearchSetters,
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
  handlers: CitySearchSetters & { onSelectCity: (city: LocationData) => void },
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

/** Validates and updates search input state synchronously on change. */
export function applySearchQueryUpdate(
  value: string,
  language: Language,
  setters: CitySearchSetters & { setQueryState: (val: string) => void },
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

/** Handles explicit search submission by selecting a cached match or querying immediately. */
export async function dispatchCitySubmit(
  params: {
    searchQuery: string;
    searchResults: LocationData[];
    language: Language;
    submitAbortRef: RefObject<AbortController | null>;
  },
  handlers: CitySearchSetters & { onSelectCity: (city: LocationData) => void },
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
