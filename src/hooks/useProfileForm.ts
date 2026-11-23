import { useRef, useState, type RefObject, type SyntheticEvent } from 'react';
import type { HouseholdGroup, Language, LifestyleProfile } from '../types/index.js';
import { validateProfile } from '../utils/validation.js';

interface UseProfileFormResult {
  errors: Record<string, string>;
  notesRef: RefObject<HTMLTextAreaElement | null>;
  toggleHousehold: (group: HouseholdGroup) => void;
  handleSubmit: (e: SyntheticEvent<HTMLFormElement>) => void;
}

/**
 * Manages validation errors, notes focus recovery, and household checkbox toggles for {@link ProfileForm}.
 */
export function useProfileForm(params: {
  language: Language;
  profile: LifestyleProfile;
  onChange: (nextProfile: LifestyleProfile) => void;
  onSubmit: (validatedProfile: LifestyleProfile) => void;
}): UseProfileFormResult {
  const { language, profile, onChange, onSubmit } = params;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  const toggleHousehold = (group: HouseholdGroup): void => {
    const exists = profile.household.includes(group);
    const nextHousehold = exists
      ? profile.household.filter((item) => item !== group)
      : [...profile.household, group];
    onChange({ ...profile, household: nextHousehold });
  };

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const validation = validateProfile(profile, language);
    if (!validation.success) {
      setErrors(validation.errors);
      if (validation.errors.notes) {
        notesRef.current?.focus();
      }
      return;
    }
    setErrors({});
    onChange(validation.data);
    onSubmit(validation.data);
  };

  return {
    errors,
    notesRef,
    toggleHousehold,
    handleSubmit,
  };
}
