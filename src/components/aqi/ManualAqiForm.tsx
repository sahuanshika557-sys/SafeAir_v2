import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { MAX_US_AQI, MIN_US_AQI } from '../../constants/index.js';
import type { TranslationDictionary } from '../../i18n/translations.js';

interface ManualAqiFormProps {
  t: TranslationDictionary;
  onApplyManualAqi: (aqi: number) => { success: boolean; error?: string };
  onApplied: () => void;
}

/**
 * Collapsible last-resort manual US AQI input form displayed when requested or when live lookup fails.
 */
export function ManualAqiForm({
  t,
  onApplyManualAqi,
  onApplied,
}: Readonly<ManualAqiFormProps>): ReactElement {
  const [manualInput, setManualInput] = useState<string>('185');
  const [manualError, setManualError] = useState<string | null>(null);

  const handleManualSubmit = (e: SyntheticEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const result = onApplyManualAqi(Number(manualInput));
    if (!result.success) {
      setManualError(result.error ?? t.manualAqiRangeError);
      return;
    }
    setManualError(null);
    onApplied();
  };

  return (
    <form
      id="manual-aqi-form"
      onSubmit={handleManualSubmit}
      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 space-y-3"
    >
      <label
        htmlFor="manual-aqi-input"
        className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
      >
        {t.manualAqiLabel}
      </label>
      <p id="manual-aqi-hint" className="text-xs text-slate-600 dark:text-slate-400">
        {t.manualAqiHint}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="manual-aqi-input"
          type="number"
          min={MIN_US_AQI}
          max={MAX_US_AQI}
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          aria-invalid={Boolean(manualError)}
          aria-describedby={manualError ? 'manual-aqi-error manual-aqi-hint' : 'manual-aqi-hint'}
          className="min-h-[44px] w-full sm:w-40 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm tabular-nums text-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          className="min-h-[44px] rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
        >
          {t.manualAqiApply}
        </button>
      </div>
      {manualError && (
        <p id="manual-aqi-error" role="alert" className="text-sm text-red-700 dark:text-red-300">
          {manualError}
        </p>
      )}
    </form>
  );
}
