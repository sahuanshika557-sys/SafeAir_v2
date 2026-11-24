import type { ReactElement } from 'react';
import type { TranslationDictionary } from '../../i18n/translations.js';
import type { ActionPlan, AirQualityReading } from '../../types/index.js';
import {
  EmptyPlanIllustration,
  ErrorStateIllustration,
  LazyIllustrationGate,
} from '../illustrations/index.js';

interface PlanStatePanelsProps {
  t: TranslationDictionary;
  plan: ActionPlan | null;
  isGenerating: boolean;
  streamCharCount: number;
  error: string | null;
  isOutdated: boolean;
  currentReading?: AirQualityReading | null;
  currentPlaceLabel?: string;
  currentCategoryLabel: string;
  onRetry: () => void;
  onRegenerateForCurrent?: () => void;
}

/**
 * Renders streaming skeleton, error + fallback notice, outdated-plan warning, and empty state panels.
 */
export function PlanStatePanels({
  t,
  plan,
  isGenerating,
  streamCharCount,
  error,
  isOutdated,
  currentReading,
  currentPlaceLabel,
  currentCategoryLabel,
  onRetry,
  onRegenerateForCurrent,
}: Readonly<PlanStatePanelsProps>): ReactElement {
  return (
    <>
      {isGenerating && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-teal-800 dark:text-teal-300 tabular-nums">
            {t.planStreamingNotice}
            {streamCharCount > 0 ? ` (${streamCharCount})` : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-36 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-36 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      )}

      {error && !isGenerating && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4 text-red-900 dark:text-red-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5"
        >
          <div className="flex items-start gap-3 min-w-0">
            <LazyIllustrationGate minHeightClass="w-11 h-11 shrink-0">
              <ErrorStateIllustration className="w-11 h-11 shrink-0" />
            </LazyIllustrationGate>
            <div className="min-w-0">
              <p className="font-semibold">{t.geminiErrorTitle}</p>
              <p className="text-sm mt-0.5">{error}</p>
              {plan?.isFallback && (
                <p className="text-xs mt-1 text-red-800 dark:text-red-200">
                  {t.fallbackBannerNotice}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 transition-colors sm:whitespace-nowrap shrink-0"
          >
            {t.retryBtn}
          </button>
        </div>
      )}

      {isOutdated && !isGenerating && currentReading && (
        <div
          role="status"
          className="rounded-lg border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 p-4 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5"
        >
          <div>
            <p className="font-semibold">{t.planOutdatedTitle}</p>
            <p className="text-sm mt-0.5">
              {t.planOutdatedBody(
                currentPlaceLabel ?? '',
                currentReading.usAqi,
                currentCategoryLabel,
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onRegenerateForCurrent ?? onRetry}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 transition-colors sm:whitespace-nowrap shrink-0"
          >
            {t.regenerateForLocationBtn}
          </button>
        </div>
      )}

      {!isGenerating && !plan && !error && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-3">
          <LazyIllustrationGate minHeightClass="h-16">
            <EmptyPlanIllustration className="w-16 h-16 mx-auto" />
          </LazyIllustrationGate>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.planEmptyTitle}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            {t.planEmptyBody}
          </p>
        </div>
      )}
    </>
  );
}
