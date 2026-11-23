import { FALLBACK_TEMPLATE_EN, FALLBACK_TEMPLATE_HI } from '../constants/fallbackTemplates.js';
import { SEVERE_AQI_THRESHOLD } from '../constants/index.js';
import type {
  ActionPlan,
  AirQualityReading,
  Language,
  LifestyleProfile,
  LocationData,
} from '../types/index.js';

/**
 * Generates a deterministic, rule-based fallback action plan tailored to AQI severity,
 * optional location, and household profile when the Gemini API is unavailable.
 *
 * @param reading - Current live or manually entered air quality reading.
 * @param profile - Household lifestyle profile for tailoring advice.
 * @param language - Target UI language (`'en'` or `'hi'`).
 * @param location - Optional location metadata stamped onto plan provenance.
 * @returns Complete four-section {@link ActionPlan} marked with `isFallback: true`.
 */
export function buildRuleBasedFallbackPlan(
  reading: AirQualityReading,
  profile: LifestyleProfile,
  language: Language,
  location?: LocationData,
): ActionPlan {
  const isHindi = language === 'hi';
  const template = isHindi ? FALLBACK_TEMPLATE_HI : FALLBACK_TEMPLATE_EN;
  const isSevere = reading.usAqi > SEVERE_AQI_THRESHOLD;
  const hasVulnerable = profile.household.length > 0;
  const placeName = location
    ? [location.name, location.country].filter(Boolean).join(', ')
    : undefined;
  const categoryLabel = isHindi ? reading.category.labelHi : reading.category.labelEn;

  return {
    generatedForLocationId: location?.id,
    generatedForLocationName: placeName,
    generatedForAqi: reading.usAqi,
    generatedForCategoryKey: reading.category.key,
    generatedForLanguage: language,
    generatedForProfile: profile,
    summary: template.buildSummary(placeName, reading.usAqi, categoryLabel),
    bestTimeWindow: template.bestTimeWindow,
    worstTimeWindow: template.worstTimeWindow,
    dailyRoutine: template.buildDailyRoutine(isSevere, profile),
    indoorAirHacks: template.buildIndoorAirHacks(profile.hasAirPurifier),
    sustainableAlternatives: template.buildSustainableAlternatives(profile),
    healthProtection: template.buildHealthProtection(isSevere, hasVulnerable),
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}
