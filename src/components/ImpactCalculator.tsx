import { memo, useMemo, useState, type ReactElement } from 'react';
import { IMPACT_CHOICES, MAX_COMBINED_PM25_REDUCTION_PERCENT } from '../constants/index.js';
import type { TranslationDictionary } from '../i18n/translations.js';
import type { ImpactChoiceId, ImpactEstimate, Language } from '../types/index.js';
import { calculateWeeklyImpact, formatApproxCo2 } from '../utils/impactCalculator.js';
import { ImpactSwapIllustration, LazyIllustrationGate } from './illustrations/index.js';

interface ImpactCalculatorProps {
  t: TranslationDictionary;
  language: Language;
}

const PERCENT_FULL = 100;

function ImpactSummaryCards({
  t,
  language,
  estimate,
}: Readonly<{
  t: TranslationDictionary;
  language: Language;
  estimate: ImpactEstimate;
}>): ReactElement {
  const progressWidth = Math.min(
    PERCENT_FULL,
    Math.round(
      (estimate.approxPm25ReductionPercent / MAX_COMBINED_PM25_REDUCTION_PERCENT) * PERCENT_FULL,
    ),
  );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t.co2SavedLabel}</p>
        <p className="mt-2 text-2xl sm:text-3xl font-bold text-teal-800 dark:text-teal-300 tabular-nums">
          {formatApproxCo2(estimate.approxCo2SavedGramsPerWeek, language)}
        </p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t.perWeekSuffix}</p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-3">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {t.pm25ReductionLabel}
        </p>
        <p className="text-2xl sm:text-3xl font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
          ~{estimate.approxPm25ReductionPercent}%
        </p>
        <div
          role="progressbar"
          aria-label={t.pm25ReductionLabel}
          aria-valuemin={0}
          aria-valuemax={MAX_COMBINED_PM25_REDUCTION_PERCENT}
          aria-valuenow={estimate.approxPm25ReductionPercent}
          aria-valuetext={`~${estimate.approxPm25ReductionPercent}%`}
          className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        >
          <svg
            viewBox="0 0 100 10"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="block h-full w-full"
          >
            <rect
              x="0"
              y="0"
              width={progressWidth}
              height="10"
              rx="5"
              className="fill-emerald-700 dark:fill-emerald-400 transition-[width]"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function ImpactAssumptionsPanel({
  t,
  language,
}: Readonly<{ t: TranslationDictionary; language: Language }>): ReactElement {
  return (
    <div
      id="impact-assumptions-panel"
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-2"
    >
      <p>{t.impactHowWeEstimateBody}</p>
      <ul className="list-disc pl-5 space-y-1">
        {IMPACT_CHOICES.map((choice) => {
          const label = language === 'hi' ? choice.labelHi : choice.labelEn;
          const desc = language === 'hi' ? choice.descriptionHi : choice.descriptionEn;
          const singlePct = Math.round(choice.approxPm25ReductionFraction * PERCENT_FULL);
          return (
            <li key={choice.id}>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{label}:</span> ~
              {singlePct}% {language === 'hi' ? 'अनुमानित आधार PM2.5 कमी' : 'base PM2.5 drop'} ·{' '}
              {desc}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Interactive weekly impact calculator showing conservative approximate CO2 avoided,
 * diminishing-returns PM2.5 exposure reduction, and transparent methodology assumptions.
 */
export const ImpactCalculator = memo(function ImpactCalculator({
  t,
  language,
}: Readonly<ImpactCalculatorProps>): ReactElement {
  const [selected, setSelected] = useState<ImpactChoiceId[]>(['metro_over_car', 'n95_mask']);
  const [showAssumptions, setShowAssumptions] = useState<boolean>(false);

  const toggleChoice = (id: ImpactChoiceId): void => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const estimate = useMemo(() => calculateWeeklyImpact(selected), [selected]);

  return (
    <section
      id="impact-calculator"
      aria-labelledby="impact-section-heading"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-6"
    >
      <div>
        <h2
          id="impact-section-heading"
          className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100"
        >
          {t.impactTitle}
        </h2>
        <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-300">
          {t.impactSubtitle}
        </p>
      </div>

      <ImpactSummaryCards t={t} language={language} estimate={estimate} />

      <fieldset>
        <legend className="sr-only">{t.impactTitle}</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {IMPACT_CHOICES.map((choice) => {
            const isChecked = selected.includes(choice.id);
            const label = language === 'hi' ? choice.labelHi : choice.labelEn;
            const desc = language === 'hi' ? choice.descriptionHi : choice.descriptionEn;
            const checkboxId = `impact-choice-${choice.id}`;
            return (
              <div
                key={choice.id}
                className={`flex min-h-[44px] items-start gap-3 rounded-lg border p-4 transition-colors ${
                  isChecked
                    ? 'border-teal-700 bg-teal-50/70 dark:border-teal-500 dark:bg-teal-950/50'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleChoice(choice.id)}
                  className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-400 text-teal-700"
                />
                <LazyIllustrationGate minHeightClass="w-9 h-9 shrink-0">
                  <ImpactSwapIllustration choiceId={choice.id} className="w-9 h-9 shrink-0" />
                </LazyIllustrationGate>
                <div className="min-w-0 flex-1 space-y-1">
                  <label
                    htmlFor={checkboxId}
                    className="block cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {label}
                  </label>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">{t.impactApproxNote}</p>
          <button
            type="button"
            aria-expanded={showAssumptions}
            aria-controls="impact-assumptions-panel"
            onClick={() => setShowAssumptions((prev) => !prev)}
            className="min-h-[44px] inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-teal-800 dark:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t.impactHowWeEstimateTitle}
          </button>
        </div>
        {showAssumptions && <ImpactAssumptionsPanel t={t} language={language} />}
      </div>
    </section>
  );
});

export default ImpactCalculator;
