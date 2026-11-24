import type { ReactElement } from 'react';
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
import { AirPurifierRadioField, ProfileNotesField } from './form/ProfileExtraFields.js';
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

const COMMUTE_MODES: readonly CommuteMode[] = [
  'walk',
  'bike',
  'bus',
  'metro',
  'two_wheeler',
  'car',
];
const WORK_STYLES: readonly WorkStyle[] = ['wfh', 'office', 'outdoor'];
const HOME_TYPES: readonly HomeType[] = ['apartment', 'house'];
const COOKING_FUELS: readonly CookingFuel[] = ['lpg', 'induction', 'wood', 'other'];
const BUDGET_LEVELS: readonly BudgetLevel[] = ['low', 'medium', 'high'];

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
        <h2
          id="profile-section-heading"
          className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100"
        >
          {t.profileTitle}
        </h2>
        <p className="mt-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-300">
          {t.profileSubtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
        <HouseholdMembersField
          t={t}
          selectedGroups={profile.household}
          onToggleGroup={toggleHousehold}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <ProfileSelectField
            id="commute-mode-select"
            label={t.commuteLabel}
            value={profile.commuteMode}
            options={COMMUTE_MODES}
            labels={t.commuteOptions}
            onChange={(commuteMode) => onChange({ ...profile, commuteMode })}
          />
          <ProfileSelectField
            id="work-style-select"
            label={t.workStyleLabel}
            value={profile.workStyle}
            options={WORK_STYLES}
            labels={t.workStyleOptions}
            onChange={(workStyle) => onChange({ ...profile, workStyle })}
          />
          <ProfileSelectField
            id="home-type-select"
            label={t.homeTypeLabel}
            value={profile.homeType}
            options={HOME_TYPES}
            labels={t.homeTypeOptions}
            onChange={(homeType) => onChange({ ...profile, homeType })}
          />
          <ProfileSelectField
            id="cooking-fuel-select"
            label={t.cookingFuelLabel}
            value={profile.cookingFuel}
            options={COOKING_FUELS}
            labels={t.cookingFuelOptions}
            onChange={(cookingFuel) => onChange({ ...profile, cookingFuel })}
          />
          <ProfileSelectField
            id="budget-select"
            label={t.budgetLabel}
            value={profile.budget}
            options={BUDGET_LEVELS}
            labels={t.budgetOptions}
            onChange={(budget) => onChange({ ...profile, budget })}
          />
          <AirPurifierRadioField
            t={t}
            hasAirPurifier={profile.hasAirPurifier}
            onSelect={(hasAirPurifier) => onChange({ ...profile, hasAirPurifier })}
          />
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
