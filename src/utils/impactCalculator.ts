import {
  GRAMS_PER_KILOGRAM,
  IMPACT_CHOICES,
  IMPACT_DIMINISHING_FACTOR,
  MAX_COMBINED_PM25_REDUCTION_PERCENT,
} from '../constants/index.js';
import type {
  ActionPlan,
  ImpactChoiceId,
  ImpactEstimate,
  Language,
  RecommendationItem,
} from '../types/index.js';

/**
 * Strips redundant leading "Approximate:", "Approx.", or Hindi "लगभग" prefixes from an
 * item's `estimatedImpact` string so UI labels like "Estimated impact (approximate):"
 * never read as "Estimated impact (approximate): Approximate: ...".
 *
 * @param rawImpact - Raw impact estimate string from Gemini or rule-based fallback.
 * @param language - Active display language (`'en'` or `'hi'`).
 * @returns Cleaned impact text without duplicated prefix labels.
 */
export function cleanImpactText(rawImpact: string, language: Language): string {
  let cleaned = rawImpact.trim();
  const patterns =
    language === 'hi'
      ? [
          /^अनुमानित\s*प्रभाव\s*(\(लगभग\))?\s*[:：-]?\s*/i,
          /^लगभग\s*[:：-]?\s*/i,
          /^अनुमानतः?\s*[:：-]?\s*/i,
          /^(estimated\s+impact\s*(\(approximate\))?|approximate|approx\.?|estimated)\s*[:：-]?\s*/i,
        ]
      : [
          /^(estimated\s+impact\s*(\(approximate\))?|approximate|approx\.?|estimated)\s*[:：-]?\s*/i,
        ];

  let previous = '';
  while (cleaned !== previous) {
    previous = cleaned;
    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, '').trim();
    }
  }
  return cleaned || rawImpact.trim();
}

const PERCENT_FACTOR = 100;

function cleanItems(
  items: readonly RecommendationItem[],
  language: Language,
): RecommendationItem[] {
  return items.map((item) => ({
    ...item,
    estimatedImpact: cleanImpactText(item.estimatedImpact, language),
  }));
}

/**
 * Normalizes every section of an {@link ActionPlan} to remove duplicate impact prefix wording.
 *
 * @param plan - Raw action plan from AI or rule-based fallback.
 * @param language - Display language of the plan.
 * @returns Action plan with sanitized `estimatedImpact` fields across all four sections.
 */
export function sanitizeActionPlanImpact(plan: ActionPlan, language: Language): ActionPlan {
  return {
    ...plan,
    dailyRoutine: cleanItems(plan.dailyRoutine, language),
    indoorAirHacks: cleanItems(plan.indoorAirHacks, language),
    sustainableAlternatives: cleanItems(plan.sustainableAlternatives, language),
    healthProtection: cleanItems(plan.healthProtection, language),
  };
}

/**
 * Computes conservative, order-independent weekly CO2 savings (grams) and combined PM2.5 exposure reduction (%).
 * Applies diminishing returns across overlapping actions (`IMPACT_DIMINISHING_FACTOR`) and caps total
 * reduction at `MAX_COMBINED_PM25_REDUCTION_PERCENT` (65%).
 *
 * @param selectedChoices - List of selected weekly impact action identifiers.
 * @returns Approximate weekly {@link ImpactEstimate} across CO2 and PM2.5 exposure.
 */
export function calculateWeeklyImpact(selectedChoices: readonly ImpactChoiceId[]): ImpactEstimate {
  const uniqueIds = Array.from(new Set(selectedChoices));
  const selectedDefs = uniqueIds
    .map((id) => IMPACT_CHOICES.find((item) => item.id === id))
    .filter((def): def is (typeof IMPACT_CHOICES)[number] => Boolean(def))
    .sort((a, b) => b.approxPm25ReductionFraction - a.approxPm25ReductionFraction);

  let totalCo2Grams = 0;
  let remainingExposureFraction = 1;

  for (const [index, def] of selectedDefs.entries()) {
    totalCo2Grams += def.approxCo2SavedGramsPerWeek;
    const effectiveFraction =
      def.approxPm25ReductionFraction * Math.pow(IMPACT_DIMINISHING_FACTOR, index);
    remainingExposureFraction *= 1 - effectiveFraction;
  }

  const rawReductionPercent = Math.round((1 - remainingExposureFraction) * PERCENT_FACTOR);
  const cappedReductionPercent = Math.min(
    MAX_COMBINED_PM25_REDUCTION_PERCENT,
    Math.max(0, rawReductionPercent),
  );

  return {
    approxCo2SavedGramsPerWeek: Math.round(totalCo2Grams),
    approxPm25ReductionPercent: cappedReductionPercent,
    selectedChoices: uniqueIds,
  };
}

/**
 * Formats weekly CO2 savings clearly as an approximate figure in grams or kilograms.
 *
 * @param grams - Estimated weekly CO2 savings in grams.
 * @param language - Target UI display language (`'en'` or `'hi'`).
 * @returns Localized human-readable approximate CO2 string.
 */
export function formatApproxCo2(grams: number, language: Language): string {
  const safeGrams = Math.max(0, Math.round(grams));
  if (safeGrams >= GRAMS_PER_KILOGRAM) {
    const kg = (safeGrams / GRAMS_PER_KILOGRAM).toFixed(1);
    return language === 'hi' ? `लगभग ${kg} किग्रा CO₂` : `Approx. ${kg} kg CO₂`;
  }
  return language === 'hi' ? `लगभग ${safeGrams} ग्राम CO₂` : `Approx. ${safeGrams} g CO₂`;
}
