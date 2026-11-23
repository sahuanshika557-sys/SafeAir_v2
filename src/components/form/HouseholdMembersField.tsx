import type { ReactElement } from 'react';
import type { TranslationDictionary } from '../../i18n/translations.js';
import type { HouseholdGroup } from '../../types/index.js';

interface HouseholdMembersFieldProps {
  t: TranslationDictionary;
  selectedGroups: readonly HouseholdGroup[];
  onToggleGroup: (group: HouseholdGroup) => void;
}

const HOUSEHOLD_GROUPS: readonly HouseholdGroup[] = [
  'children',
  'elderly',
  'respiratory',
  'pregnant',
];

/**
 * Checkbox group allowing selection of household air-pollution sensitivity demographics.
 */
export function HouseholdMembersField({
  t,
  selectedGroups,
  onToggleGroup,
}: Readonly<HouseholdMembersFieldProps>): ReactElement {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {t.householdLabel}
      </legend>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {HOUSEHOLD_GROUPS.map((group) => {
          const checked = selectedGroups.includes(group);
          return (
            <label
              key={group}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                checked
                  ? 'border-teal-700 bg-teal-50 text-teal-950 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-100'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleGroup(group)}
                className="h-5 w-5 rounded border-slate-400 text-teal-700"
              />
              <span>{t.householdOptions[group]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
