import type { ReactElement, RefObject } from 'react';
import { MAX_FREE_TEXT_LENGTH } from '../constants/index.js';
import { useProfileForm } from '../hooks/useProfileForm.js';
import type { TranslationDictionary } from '../i18n/translations.js';
import type {
  BudgetLevel,
  CommuteMode,
  CookingFuel,
  HomeType,
  Language,
  LifestyleProfile,
  WorkStyle,
} from '../types/index.js';
import { HouseholdMembersField } from './form/HouseholdMembersField.js';
import { ProfileSelectField } from './form/ProfileSelectField.js';

interface ProfileFormProps {
  t: TranslationDictionary;
  language?: Language;
  profile: LifestyleProfile;
  onChange: (nextProfile: LifestyleProfile) => void;
  onSubmit: (validatedProfile: LifestyleProfile) => void;
  isGenerating: boolean;
  hasReading: boolean;
}

const COMMUTE_MODES: readonly CommuteMode[] = ['walk', 'bike', 'bus', 'metro', 'two_wheeler', 'car'];
const WORK_STYLES: readonly WorkStyle[] = ['wfh', 'office', 'outdoor'];
const HOME_TYPES: readonly HomeType[] = ['apartment', 'house'];
const COOKING_FUELS: readonly CookingFuel[] = ['lpg', 'induction', 'wood', 'other'];
const BUDGET_LEVELS: readonly BudgetLevel[] = ['low', 'medium', 'high'];

function AirPurifierRadioField({
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

function ProfileNotesField({
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
        <p id="profile-notes-error" role="alert" className="mt-1.5 text-sm font-medium text-red-700 dark:text-red-300">
          {notesError}
        </p>
      )}
    </div>
  );
}

/**
 * Accessible household and lifestyle profile form with Zod validation and ARIA error linking.
 */
export function ProfileForm({
  t,
  language = 'en',
  profile,
  onChange,
  onSubmit,
  isGenerating,
  hasReading,
}: Readonly<ProfileFormProps>): ReactElement {
  const { errors, notesRef, toggleHousehold, handleSubmit } = useProfileForm({
    language,
    profile,
    onChange,
    onSubmit,
  });

  return (
    <section
      id="lifestyle-profile"
      aria-labelledby="profile-section-heading"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8"
    >
      <div className="max-w-3xl">
        <h2 id="profile-section-heading" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t.profileTitle}
        </h2>
        <p className="mt-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-300">{t.profileSubtitle}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
        <HouseholdMembersField t={t} selectedGroups={profile.household} onToggleGroup={toggleHousehold} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <ProfileSelectField id="commute-mode-select" label={t.commuteLabel} value={profile.commuteMode} options={COMMUTE_MODES} labels={t.commuteOptions} onChange={(commuteMode) => onChange({ ...profile, commuteMode })} />
          <ProfileSelectField id="work-style-select" label={t.workStyleLabel} value={profile.workStyle} options={WORK_STYLES} labels={t.workStyleOptions} onChange={(workStyle) => onChange({ ...profile, workStyle })} />
          <ProfileSelectField id="home-type-select" label={t.homeTypeLabel} value={profile.homeType} options={HOME_TYPES} labels={t.homeTypeOptions} onChange={(homeType) => onChange({ ...profile, homeType })} />
          <ProfileSelectField id="cooking-fuel-select" label={t.cookingFuelLabel} value={profile.cookingFuel} options={COOKING_FUELS} labels={t.cookingFuelOptions} onChange={(cookingFuel) => onChange({ ...profile, cookingFuel })} />
          <ProfileSelectField id="budget-select" label={t.budgetLabel} value={profile.budget} options={BUDGET_LEVELS} labels={t.budgetOptions} onChange={(budget) => onChange({ ...profile, budget })} />
          <AirPurifierRadioField t={t} hasAirPurifier={profile.hasAirPurifier} onSelect={(hasAirPurifier) => onChange({ ...profile, hasAirPurifier })} />
        </div>

        <ProfileNotesField
          t={t}
          notes={profile.notes}
          notesError={errors.notes}
          notesRef={notesRef}
          onNotesChange={(notes) => onChange({ ...profile, notes })}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <button
            type="submit"
            disabled={isGenerating || !hasReading}
            aria-busy={isGenerating}
            className={`inline-flex min-h-[48px] items-center justify-center rounded-lg bg-teal-800 px-6 py-3 text-base font-semibold text-white hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60 transition-colors ${
              isGenerating ? 'safeair-btn-loading-pulse' : ''
            }`}
          >
            {isGenerating ? t.generatingPlanBtn : t.generatePlanBtn}
          </button>
        </div>
      </form>
    </section>
  );
}
