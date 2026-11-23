import type { ReactElement } from 'react';
import type { TranslationDictionary } from '../../i18n/translations.js';
import type { AirQualityReading, Language } from '../../types/index.js';
import { formatAqiTimestamp } from '../../utils/aqi.js';
import { AqiStatusIcon } from '../Icons.js';
import { AqiGauge } from './AqiGauge.js';

interface PollutantGridProps {
  t: TranslationDictionary;
  language: Language;
  locationDisplay: string;
  reading: AirQualityReading;
  animationsPaused: boolean;
}

/**
 * Displays the live US AQI gauge, health summary, four key pollutant concentrations, and timestamp.
 */
export function PollutantGrid({
  t,
  language,
  locationDisplay,
  reading,
  animationsPaused,
}: Readonly<PollutantGridProps>): ReactElement {
  const categoryLabel = language === 'hi' ? reading.category.labelHi : reading.category.labelEn;
  const categorySummary =
    language === 'hi' ? reading.category.summaryHi : reading.category.summaryEn;
  const sourceDisplay = reading.isManual ? t.manualAqiSource : t.liveAqiSource;
  const formatPollutant = (value: number | null): string =>
    value === null ? t.notAvailable : `${value} ${t.unitUgM3}`;

  const pollutants: ReadonlyArray<readonly [string, number | null]> = [
    [t.pollutantPm25, reading.pm25],
    [t.pollutantPm10, reading.pm10],
    [t.pollutantNo2, reading.no2],
    [t.pollutantO3, reading.o3],
  ];

  return (
    <div
      className={`rounded-xl border ${reading.category.borderClass} ${reading.category.surfaceClass} p-6 space-y-4`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 break-words">
            {locationDisplay}
          </p>
          <div className={`mt-1 flex items-center gap-2 ${reading.category.textClass}`}>
            <AqiStatusIcon categoryKey={reading.category.key} className="w-5 h-5 shrink-0" />
            <span className="text-lg font-bold">{categoryLabel}</span>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
          {t.aqiScaleLabel}
        </span>
      </div>

      <AqiGauge
        aqi={reading.usAqi}
        accentHex={reading.category.accentHex}
        ariaLabel={t.aqiGaugeAriaLabel(reading.usAqi, categoryLabel)}
        animationsPaused={animationsPaused}
      />

      <p className={`text-sm leading-relaxed ${reading.category.textClass}`}>{categorySummary}</p>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-300/60 dark:border-slate-700/60 text-sm">
        {pollutants.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
            <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatPollutant(value)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="pt-2 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
        <span>
          {t.aqiSourceLabel}: {sourceDisplay}
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          {t.updatedLabel}: {formatAqiTimestamp(reading.timestamp, language)}
        </span>
      </div>
    </div>
  );
}
