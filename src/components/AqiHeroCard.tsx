import { useState, type ReactElement } from 'react';
import type { TranslationDictionary } from '../i18n/translations.js';
import type { AirQualityReading, Language, LocationData } from '../types/index.js';
import { AqiReadingStatusPanel } from './aqi/AqiReadingStatusPanel.js';
import { CitySearchControl } from './aqi/CitySearchControl.js';
import { ManualAqiForm } from './aqi/ManualAqiForm.js';
import { CleanAirThoughtCard } from './CleanAirThoughtCard.js';
import { RefreshIcon } from './Icons.js';
import { HeroSkylineIllustration } from './illustrations/index.js';

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

function HeroHeadingBlock({ t }: Readonly<{ t: TranslationDictionary }>): ReactElement {
  return (
    <div>
      <p className="text-sm font-medium text-teal-800 dark:text-teal-300">{t.heroEyebrow}</p>
      <h1
        id="aqi-section-heading"
        className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 [text-wrap:balance]"
      >
        {t.heroTitle}
      </h1>
      <p className="mt-1.5 text-sm sm:text-base font-semibold text-teal-800 dark:text-teal-300">
        {t.heroTagline}
      </p>
      <p className="mt-2.5 text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl">
        {t.heroSubtitle}
      </p>
    </div>
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
          <HeroHeadingBlock t={t} />
          <div className="space-y-3">
            <CitySearchControl
              t={t}
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              searchResults={searchResults}
              hasSearched={hasSearched}
              isSearching={isSearching}
              searchError={searchError}
              onSelectCity={onSelectCity}
              onSubmitCitySearch={onSubmitCitySearch}
              onRequestGeolocation={onRequestGeolocation}
              isLocating={isLocating}
              geoError={geoError}
            />
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={onRefreshAqi}
                disabled={isLoadingAqi}
                className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-teal-800 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-200 disabled:opacity-50"
              >
                <RefreshIcon className="w-4 h-4" />
                <span>{t.refreshReading}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowManualForm((prev) => !prev)}
                aria-expanded={Boolean(showManualForm || aqiError)}
                aria-controls="manual-aqi-form"
                className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 underline underline-offset-4 hover:text-slate-900 dark:hover:text-white"
              >
                {t.manualAqiToggle}
              </button>
            </div>
            {(showManualForm || aqiError) && (
              <ManualAqiForm
                t={t}
                onApplyManualAqi={onApplyManualAqi}
                onApplied={() => setShowManualForm(false)}
              />
            )}
          </div>
          <CleanAirThoughtCard t={t} animationsPaused={animationsPaused} />
        </div>

        <div className="lg:col-span-5 space-y-4 min-w-0">
          <HeroSkylineIllustration
            categoryKey={reading?.category.key ?? 'moderate'}
            locationName={locationDisplay}
            categoryLabel={categoryLabel || (language === 'hi' ? 'मध्यम' : 'Moderate')}
            t={t}
            animationsPaused={animationsPaused}
          />
          <div aria-live="polite" aria-busy={isLoadingAqi}>
            <AqiReadingStatusPanel
              t={t}
              language={language}
              locationDisplay={locationDisplay}
              reading={reading}
              isLoadingAqi={isLoadingAqi}
              aqiError={aqiError}
              animationsPaused={animationsPaused}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
