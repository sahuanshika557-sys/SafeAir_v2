import type { ReactElement, SyntheticEvent } from 'react';
import { MAX_SEARCH_QUERY_LENGTH, MIN_SEARCH_QUERY_LENGTH } from '../../constants/index.js';
import type { TranslationDictionary } from '../../i18n/translations.js';
import type { LocationData } from '../../types/index.js';
import { LocateIcon, SearchIcon } from '../Icons.js';

interface CitySearchControlProps {
  t: TranslationDictionary;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  searchResults: LocationData[];
  hasSearched: boolean;
  isSearching: boolean;
  searchError: string | null;
  onSelectCity: (city: LocationData) => void;
  onSubmitCitySearch?: () => void;
  onRequestGeolocation: () => void;
  isLocating: boolean;
  geoError: string | null;
}

/**
 * Renders accessible city search input, candidate picker, and browser geolocation button.
 */
export function CitySearchControl({
  t,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  hasSearched,
  isSearching,
  searchError,
  onSelectCity,
  onSubmitCitySearch,
  onRequestGeolocation,
  isLocating,
  geoError,
}: Readonly<CitySearchControlProps>): ReactElement {
  const handleSearchSubmit = (e: SyntheticEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (onSubmitCitySearch) {
      onSubmitCitySearch();
      return;
    }
    const firstCity = searchResults[0];
    if (firstCity) {
      onSelectCity(firstCity);
    }
  };

  const showEmptyResults =
    !isSearching &&
    hasSearched &&
    searchResults.length === 0 &&
    !searchError &&
    searchQuery.trim().length >= MIN_SEARCH_QUERY_LENGTH;

  return (
    <>
      <form onSubmit={handleSearchSubmit} className="space-y-2">
        <label
          htmlFor="city-search-input"
          className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
        >
          {t.citySearchLabel}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400">
              <SearchIcon className="w-4 h-4" />
            </span>
            <input
              id="city-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={t.citySearchPlaceholder}
              maxLength={MAX_SEARCH_QUERY_LENGTH}
              autoComplete="off"
              aria-invalid={Boolean(searchError)}
              aria-describedby={searchError ? 'city-search-error' : undefined}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-600 dark:placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 transition-colors whitespace-nowrap shrink-0"
          >
            {t.citySearchBtn}
          </button>
          <button
            type="button"
            onClick={onRequestGeolocation}
            disabled={isLocating}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <LocateIcon className="w-4 h-4" />
            <span>{isLocating ? t.locating : t.useMyLocation}</span>
          </button>
        </div>
      </form>

      {isSearching && (
        <p className="text-xs text-slate-600 dark:text-slate-400" aria-live="polite">
          {t.searchingCities}
        </p>
      )}

      {searchError && (
        <p id="city-search-error" role="alert" className="text-sm text-red-700 dark:text-red-300">
          {searchError}
        </p>
      )}

      {geoError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {geoError}
        </p>
      )}

      {searchResults.length > 0 && (
        <ul
          aria-label={t.matchingCitiesLabel}
          className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
        >
          {searchResults.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                onClick={() => onSelectCity(city)}
                className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="font-medium">{city.name}</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {[city.admin1, city.country].filter(Boolean).join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showEmptyResults && (
        <p className="text-xs text-slate-600 dark:text-slate-400" aria-live="polite">
          {t.cityNoResults}
        </p>
      )}
    </>
  );
}
