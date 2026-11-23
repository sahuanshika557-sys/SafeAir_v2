import type { TranslationDictionary } from '../../i18n/translations.js';
import type {
  ActionPlan,
  AirQualityReading,
  Language,
  LifestyleProfile,
  LocationData,
  PlanSectionKey,
} from '../../types/index.js';
import { cleanImpactText } from '../../utils/impactCalculator.js';

/**
 * Formats a concise human-readable summary explaining which profile and location
 * factors tailored the generated action plan.
 */
export function buildWhyFitsSummary(
  t: TranslationDictionary,
  language: Language,
  profile: LifestyleProfile | undefined,
  locationName: string | undefined,
  reading: AirQualityReading | null | undefined,
): string {
  const parts: string[] = [];
  if (locationName && reading) {
    const cat = language === 'hi' ? reading.category.labelHi : reading.category.labelEn;
    parts.push(`${locationName} (${reading.usAqi} US AQI · ${cat})`);
  }
  if (profile) {
    if (profile.household.length > 0) {
      parts.push(profile.household.map((g) => t.householdOptions[g]).join(', '));
    }
    parts.push(t.commuteOptions[profile.commuteMode]);
    parts.push(t.workStyleOptions[profile.workStyle]);
    parts.push(t.homeTypeOptions[profile.homeType]);
    parts.push(
      profile.hasAirPurifier
        ? `${t.purifierLabel} ${t.purifierYes}`
        : `${t.purifierLabel} ${t.purifierNo}`,
    );
    parts.push(t.cookingFuelOptions[profile.cookingFuel]);
    parts.push(t.budgetOptions[profile.budget]);
  }
  return parts.join(' · ');
}

/**
 * Determines whether the currently displayed action plan no longer matches the active
 * location, air-quality reading, or UI language.
 */
export function isPlanOutdated(
  plan: ActionPlan | null,
  currentReading: AirQualityReading | null | undefined,
  currentLocation: LocationData | undefined,
  language: Language,
): boolean {
  if (!plan || !currentReading) {
    return false;
  }
  const aqiMismatch =
    plan.generatedForAqi !== undefined && plan.generatedForAqi !== currentReading.usAqi;
  const locationMismatch =
    plan.generatedForLocationId !== undefined &&
    currentLocation !== undefined &&
    plan.generatedForLocationId !== currentLocation.id;
  const languageMismatch =
    plan.generatedForLanguage !== undefined && plan.generatedForLanguage !== language;
  return aqiMismatch || locationMismatch || languageMismatch;
}

/**
 * Builds the plain-text speech script for reading the currently active plan tab aloud.
 */
export function buildPlanSpeechText(params: {
  t: TranslationDictionary;
  language: Language;
  plan: ActionPlan;
  activeTab: PlanSectionKey;
  tabLabel: string;
  outdated: boolean;
}): string {
  const { t, language, plan, activeTab, tabLabel, outdated } = params;
  const items = plan[activeTab];
  const spokenParts = [
    ...(outdated ? [] : [plan.summary]),
    `${tabLabel}.`,
    ...items.map(
      (item) =>
        `${item.title}. ${item.detail} ${t.whyItHelpsLabel}: ${item.whyItHelps}. ${t.estimatedImpactLabel}: ${cleanImpactText(item.estimatedImpact, language)}.`,
    ),
  ];
  return spokenParts.join(' ');
}
