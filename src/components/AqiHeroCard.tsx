import { useState, type ReactElement } from 'react';
import type { TranslationDictionary } from '../i18n/translations.js';
import type { AirQualityReading, Language, LocationData } from '../types/index.js';
import { CitySearchControl } from './aqi/CitySearchControl.js';
import { ManualAqiForm } from './aqi/ManualAqiForm.js';
import { PollutantGrid } from './aqi/PollutantGrid.js';
import { CleanAirThoughtCard } from './CleanAirThoughtCard.js';
import { RefreshIcon } from './Icons.js';
import { ErrorStateIllustration, HeroSkylineIllustration } from './illustrations/index.js';

interface AqiHeroCardProps {
  t: TranslationDictionary;
  language: Language;
  location: LocationData;
  reading: AirQualityReading | null;
  isLoadingAqi: boolean;
  aqiError: string | null;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  searchResults: LocationData[];
  hasSearched?: boolean;
  isSearching: boolean;
  searchError: string | null;
  onSelectCity: (city: LocationData) => void;
  onSubmitCitySearch?: () => void;
  onRequestGeolocation: () => void;
  isLocating: boolean;
  geoError: string | null;
  onApplyManualAqi: (aqi: number) => { success: boolean; error?: string };
  onRefreshAqi: () => void;
  animationsPaused?: boolean;
}

function AqiReadingStatusPanel({
  t,
  language,
  locationDisplay,
  reading,
  isLoadingAqi,
  aqiError,
  animationsPaused,
}: Readonly<{
  t: TranslationDictionary;
  language: Language;
  locationDisplay: string;
  reading: AirQualityReading | null;
  isLoadingAqi: boolean;
  aqiError: string | null;
  animationsPaused: boolean;
}>): ReactElement | null {
  if (isLoadingAqi && !reading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 space-y-4">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-20 w-36 mx-auto animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <p className="text-xs text-slate-600 dark:text-slate-400">{t.aqiLoading}</p>
      </div>
    );
  }
  if (aqiError && !reading) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/60 p-6 text-red-900 dark:text-red-100 flex items-start gap-4"
      >
        <ErrorStateIllustration className="w-11 h-11 shrink-0" />
        <div className="space-y-1.5 min-w-0">
          <h2 className="text-base font-semibold">{t.aqiErrorTitle}</h2>
          <p className="text-sm">{aqiError}</p>
        </div>
      </div>
    );
  }
  if (!reading) {
    return null;
  }
  return (
    <PollutantGrid
      t={t}
      language={language}
      locationDisplay={locationDisplay}
      reading={reading}
      animationsPaused={animationsPaused}
    />
  );
}

/**
 * Renders the location selector (city search, geolocation, manual AQI last-resort fallback),
 * AQI-reactive city skyline illustration, rotating Clean-air thought card, and live AQI card.
 */
export function AqiHeroCard({
  t,
  language,
  location,
  reading,
  isLoadingAqi,
  aqiError,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  hasSearched = false,
  isSearching,
  searchError,
  onSelectCity,
  onSubmitCitySearch,
  onRequestGeolocation,
  isLocating,
  geoError,
  onApplyManualAqi,
  onRefreshAqi,
  animationsPaused = false,
}: Readonly<AqiHeroCardProps>): ReactElement {
  const [showManualForm, setShowManualForm] = useState<boolean>(false);
  const categoryLabel = reading
    ? language === 'hi'
      ? reading.category.labelHi
      : reading.category.labelEn
    : '';
  const locationDisplay =
    location.id === 'default-new-delhi' && language === 'hi'
      ? 'नई दिल्ली, दिल्ली, भारत'
      : [location.name, location.admin1, location.country].filter(Boolean).join(', ');

  return (
    <section
      id="air-quality"
      aria-labelledby="aqi-section-heading"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8"
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7 space-y-5 min-w-0">
          <div>
            <p className="text-sm font-medium text-teal-800 dark:text-teal-300">{t.heroEyebrow}</p>
            <h1 id="aqi-section-heading" className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 [text-wrap:balance]">
              {t.heroTitle}
            </h1>
            <p className="mt-1.5 text-sm sm:text-base font-semibold text-teal-800 dark:text-teal-300">{t.heroTagline}</p>
            <p className="mt-2.5 text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl">{t.heroSubtitle}</p>
          </div>
          <div className="space-y-3">
            <CitySearchControl
              t={t} searchQuery={searchQuery} onSearchQueryChange={onSearchQueryChange}
              searchResults={searchResults} hasSearched={hasSearched} isSearching={isSearching}
              searchError={searchError} onSelectCity={onSelectCity} onSubmitCitySearch={onSubmitCitySearch}
              onRequestGeolocation={onRequestGeolocation} isLocating={isLocating} geoError={geoError}
            />
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button" onClick={onRefreshAqi} disabled={isLoadingAqi}
                className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-teal-800 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-200 disabled:opacity-50"
              >
                <RefreshIcon className="w-4 h-4" />
                <span>{t.refreshReading}</span>
              </button>
              <button
                type="button" onClick={() => setShowManualForm((prev) => !prev)}
                aria-expanded={Boolean(showManualForm || aqiError)} aria-controls="manual-aqi-form"
                className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 underline underline-offset-4 hover:text-slate-900 dark:hover:text-white"
              >
                {t.manualAqiToggle}
              </button>
            </div>
            {(showManualForm || aqiError) && (
              <ManualAqiForm t={t} onApplyManualAqi={onApplyManualAqi} onApplied={() => setShowManualForm(false)} />
            )}
          </div>
          <CleanAirThoughtCard t={t} animationsPaused={animationsPaused} />
        </div>

        <div className="lg:col-span-5 space-y-4 min-w-0" aria-live="polite" aria-busy={isLoadingAqi}>
          <HeroSkylineIllustration
            categoryKey={reading?.category.key ?? 'moderate'}
            locationName={locationDisplay}
            categoryLabel={categoryLabel || (language === 'hi' ? 'मध्यम' : 'Moderate')}
            t={t}
            animationsPaused={animationsPaused}
          />
          <AqiReadingStatusPanel
            t={t} language={language} locationDisplay={locationDisplay}
            reading={reading} isLoadingAqi={isLoadingAqi} aqiError={aqiError}
            animationsPaused={animationsPaused}
          />
        </div>
      </div>
    </section>
  );
}
