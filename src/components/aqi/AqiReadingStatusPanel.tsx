import type { ReactElement } from 'react';
import type { TranslationDictionary } from '../../i18n/translations.js';
import type { AirQualityReading, Language } from '../../types/index.js';
import { ErrorStateIllustration } from '../illustrations/index.js';
import { PollutantGrid } from './PollutantGrid.js';

interface AqiReadingStatusPanelProps {
  t: TranslationDictionary;
  language: Language;
  locationDisplay: string;
  reading: AirQualityReading | null;
  isLoadingAqi: boolean;
  aqiError: string | null;
  animationsPaused: boolean;
}

/**
 * Renders the live AQI pollutant panel, accessible loading skeleton, or localized error card.
 */
export function AqiReadingStatusPanel({
  t,
  language,
  locationDisplay,
  reading,
  isLoadingAqi,
  aqiError,
  animationsPaused,
}: Readonly<AqiReadingStatusPanelProps>): ReactElement | null {
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
