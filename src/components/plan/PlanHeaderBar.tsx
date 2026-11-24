import type { ReactElement } from 'react';
import type { TranslationDictionary } from '../../i18n/translations.js';
import { ShieldIcon, StopIcon, VolumeIcon } from '../Icons.js';

interface PlanHeaderBarProps {
  t: TranslationDictionary;
  showReadAloud: boolean;
  isSpeaking: boolean;
  onReadAloud: () => void;
}

/**
 * Renders the Action Plan header, accessible Read Aloud toggle, and non-medical guidance disclaimer.
 */
export function PlanHeaderBar({
  t,
  showReadAloud,
  isSpeaking,
  onReadAloud,
}: Readonly<PlanHeaderBarProps>): ReactElement {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2
            id="plan-section-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100"
          >
            {t.planTitle}
          </h2>
          <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-300">
            {t.planSubtitle}
          </p>
        </div>

        {showReadAloud && (
          <button
            type="button"
            onClick={onReadAloud}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors sm:whitespace-nowrap shrink-0"
          >
            {isSpeaking ? (
              <>
                <StopIcon className="w-4 h-4" />
                <span>{t.stopReadingBtn}</span>
              </>
            ) : (
              <>
                <VolumeIcon className="w-4 h-4" />
                <span>{t.readAloudBtn}</span>
              </>
            )}
          </button>
        )}
      </div>

      <div
        role="note"
        aria-label={t.medicalDisclaimerTitle}
        className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-4 text-sm text-amber-950 dark:text-amber-100 flex items-start gap-3"
      >
        <ShieldIcon className="w-5 h-5 mt-0.5 shrink-0 text-amber-800 dark:text-amber-300" />
        <div>
          <p className="font-semibold">{t.medicalDisclaimerTitle}</p>
          <p className="mt-0.5 leading-relaxed">{t.medicalDisclaimerText}</p>
        </div>
      </div>
    </>
  );
}
