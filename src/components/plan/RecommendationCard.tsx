import { memo, type ReactElement } from 'react';
import type { TranslationDictionary } from '../../i18n/translations.js';
import type { Language, RecommendationItem } from '../../types/index.js';
import { cleanImpactText } from '../../utils/impactCalculator.js';

interface RecommendationCardProps {
  item: RecommendationItem;
  language: Language;
  t: TranslationDictionary;
}

/**
 * Renders a single recommendation card with rationale, time window, and conservative impact estimate.
 */
export const RecommendationCard = memo(function RecommendationCard({
  item,
  language,
  t,
}: RecommendationCardProps): ReactElement {
  const cleanedImpact = cleanImpactText(item.estimatedImpact, language);

  return (
    <article className="safeair-card-enter rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">{item.title}</h4>
        {item.timeWindow && (
          <span className="text-xs font-medium text-teal-800 dark:text-teal-300 tabular-nums">
            {item.timeWindow}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{item.detail}</p>

      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 text-sm">
        <p className="text-slate-800 dark:text-slate-200">
          <span className="font-semibold">{t.whyItHelpsLabel}: </span>
          {item.whyItHelps}
        </p>
        <p className="text-teal-900 dark:text-teal-200 font-medium tabular-nums">
          <span className="font-semibold">{t.estimatedImpactLabel}: </span>
          {cleanedImpact}
        </p>
      </div>
    </article>
  );
});
