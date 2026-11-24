import type { ReactElement, RefObject } from 'react';
import { MAX_FREE_TEXT_LENGTH } from '../../constants/index.js';
import type { TranslationDictionary } from '../../i18n/translations.js';

/** Radio-toggle field capturing indoor air purifier ownership. */
export function AirPurifierRadioField({
  t,
  hasAirPurifier,
  onSelect,
}: Readonly<{
  t: TranslationDictionary;
  hasAirPurifier: boolean;
  onSelect: (value: boolean) => void;
}>): ReactElement {
  const options: ReadonlyArray<readonly [boolean, string]> = [
    [true, t.purifierYes],
    [false, t.purifierNo],
  ];
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {t.purifierLabel}
      </legend>
      <div className="mt-2 flex gap-3">
        {options.map(([optionVal, optionLabel]) => {
          const isSelected = hasAirPurifier === optionVal;
          return (
            <label
              key={String(optionVal)}
              className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                isSelected
                  ? 'border-teal-700 bg-teal-50 text-teal-950 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-100'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200'
              }`}
            >
              <input
                type="radio"
                name="hasAirPurifier"
                checked={isSelected}
                onChange={() => onSelect(optionVal)}
                className="h-4 w-4 text-teal-700"
              />
              <span>{optionLabel}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Accessible optional lifestyle notes textarea with character counter and error alert. */
export function ProfileNotesField({
  t,
  notes,
  notesError,
  notesRef,
  onNotesChange,
}: Readonly<{
  t: TranslationDictionary;
  notes: string;
  notesError?: string;
  notesRef: RefObject<HTMLTextAreaElement | null>;
  onNotesChange: (nextNotes: string) => void;
}>): ReactElement {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="profile-notes-textarea"
          className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
        >
          {t.notesLabel}
        </label>
        <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
          {notes.length}/{MAX_FREE_TEXT_LENGTH} {t.notesCounterSuffix}
        </span>
      </div>
      <textarea
        ref={notesRef}
        id="profile-notes-textarea"
        rows={2}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder={t.notesPlaceholder}
        aria-invalid={Boolean(notesError)}
        aria-describedby={notesError ? 'profile-notes-error' : undefined}
        className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-600 dark:placeholder:text-slate-400"
      />
      {notesError && (
        <p
          id="profile-notes-error"
          role="alert"
          className="mt-1.5 text-sm font-medium text-red-700 dark:text-red-300"
        >
          {notesError}
        </p>
      )}
    </div>
  );
}
