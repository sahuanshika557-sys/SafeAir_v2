import { z } from 'zod';
import {
  MAX_FREE_TEXT_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
  MAX_US_AQI,
  MIN_SEARCH_QUERY_LENGTH,
  MIN_US_AQI,
} from '../constants/index.js';
import type { Language, LifestyleProfile } from '../types/index.js';

const ASCII_SPACE_CODE = 32;
const ASCII_DEL_CODE = 127;
const MAX_HOUSEHOLD_GROUPS = 4;
const MAX_PLAN_ITEMS_PER_SECTION = 6;
const MAX_SUMMARY_LENGTH = 600;
const MAX_TIME_WINDOW_LENGTH = 160;
const MAX_DETAIL_LENGTH = 600;
const MAX_WHY_LENGTH = 500;
const MAX_IMPACT_LENGTH = 200;
const MAX_ITEM_TIME_WINDOW_LENGTH = 120;

/**
 * Sanitizes user free-text input by stripping HTML tags, control characters,
 * and prompt-delimiter tokens while normalizing whitespace and length.
 *
 * @param raw - Raw user-supplied text.
 * @param maxLength - Maximum output character limit.
 * @returns Sanitized and trimmed string within `maxLength`.
 */
export function sanitizeTextInput(raw: string, maxLength: number = MAX_FREE_TEXT_LENGTH): string {
  let withoutControlChars = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    withoutControlChars += code < ASCII_SPACE_CODE || code === ASCII_DEL_CODE ? ' ' : (raw[i] ?? '');
  }
  const withoutTags = withoutControlChars.replace(/[<>]/g, '');
  const withoutDelimiterSpoofing = withoutTags.replace(/<<<|>>>/g, '');
  const collapsed = withoutDelimiterSpoofing.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, maxLength);
}

/**
 * Sanitizes and validates a city search query with localized error messages.
 *
 * @param rawQuery - Raw city search string typed by the user.
 * @param language - UI language for error messages (`'en'` or `'hi'`).
 * @returns Validation flag, sanitized query, and optional localized error message.
 */
export function validateCityQuery(
  rawQuery: string,
  language: Language = 'en',
): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  const sanitized = sanitizeTextInput(rawQuery, MAX_SEARCH_QUERY_LENGTH).replace(
    /[^\p{L}\p{N}\s,.-]/gu,
    '',
  );
  if (sanitized.length < MIN_SEARCH_QUERY_LENGTH) {
    return {
      valid: false,
      sanitized,
      error:
        language === 'hi'
          ? 'शहर खोजने के लिए कम से कम 2 अक्षर दर्ज करें।'
          : 'Enter at least 2 characters to search for a city.',
    };
  }
  return { valid: true, sanitized };
}

/**
 * Zod schema for validating manual US AQI entries.
 */
export const manualAqiSchema = z
  .number({ error: 'Enter a valid numeric AQI value.' })
  .min(MIN_US_AQI, `AQI must be at least ${MIN_US_AQI}.`)
  .max(MAX_US_AQI, `AQI must be at most ${MAX_US_AQI}.`);

/**
 * Validates a manual US AQI value and returns a localized error message if invalid.
 *
 * @param value - Numeric US AQI entered by the user.
 * @param language - UI language for error messages (`'en'` or `'hi'`).
 * @returns Discriminated validation result containing validated AQI or localized error text.
 */
export function validateManualAqi(
  value: number,
  language: Language = 'en',
): { success: true; data: number } | { success: false; error: string } {
  const parsed = manualAqiSchema.safeParse(value);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return {
    success: false,
    error:
      language === 'hi'
        ? `कृपया ${MIN_US_AQI} से ${MAX_US_AQI} के बीच मान्य AQI मान दर्ज करें।`
        : `Enter a valid AQI between ${MIN_US_AQI} and ${MAX_US_AQI}.`,
  };
}

/**
 * Zod schema for validating the household lifestyle profile form.
 */
export const lifestyleProfileSchema = z.object({
  household: z
    .array(z.enum(['children', 'elderly', 'respiratory', 'pregnant']))
    .max(MAX_HOUSEHOLD_GROUPS),
  commuteMode: z.enum(['walk', 'bike', 'bus', 'metro', 'two_wheeler', 'car']),
  workStyle: z.enum(['wfh', 'office', 'outdoor']),
  homeType: z.enum(['apartment', 'house']),
  hasAirPurifier: z.boolean(),
  cookingFuel: z.enum(['lpg', 'induction', 'wood', 'other']),
  budget: z.enum(['low', 'medium', 'high']),
  notes: z
    .string()
    .max(MAX_FREE_TEXT_LENGTH, `Notes must be ${MAX_FREE_TEXT_LENGTH} characters or fewer.`)
    .transform((val) => sanitizeTextInput(val, MAX_FREE_TEXT_LENGTH)),
});

/**
 * Validates and sanitizes a lifestyle profile object with localized errors.
 *
 * @param input - Household lifestyle profile submitted from the form.
 * @param language - UI language for localized validation messages (`'en'` or `'hi'`).
 * @returns Discriminated validation result with sanitized profile data or field errors.
 */
export function validateProfile(
  input: LifestyleProfile,
  language: Language = 'en',
): { success: true; data: LifestyleProfile } | { success: false; errors: Record<string, string> } {
  const parsed = lifestyleProfileSchema.safeParse(input);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : 'form';
    if (key === 'notes') {
      errors[key] =
        language === 'hi'
          ? `अतिरिक्त जानकारी ${MAX_FREE_TEXT_LENGTH} अक्षरों से अधिक नहीं होनी चाहिए।`
          : `Notes must be ${MAX_FREE_TEXT_LENGTH} characters or fewer.`;
    } else {
      errors[key] = language === 'hi' ? 'कृपया मान्य विकल्प चुनें।' : 'Please select a valid option.';
    }
  }
  return { success: false, errors };
}

/**
 * Validates and sanitizes a follow-up chat message with localized errors.
 *
 * @param raw - Raw chat message text submitted by the user.
 * @param language - UI language for localized validation messages (`'en'` or `'hi'`).
 * @returns Validation status, sanitized message, and optional localized error string.
 */
export function validateChatMessage(
  raw: string,
  language: Language = 'en',
): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  if (raw.length > MAX_FREE_TEXT_LENGTH) {
    return {
      valid: false,
      sanitized: sanitizeTextInput(raw, MAX_FREE_TEXT_LENGTH),
      error:
        language === 'hi'
          ? `संदेश ${MAX_FREE_TEXT_LENGTH} अक्षरों से अधिक नहीं होना चाहिए।`
          : `Message must be ${MAX_FREE_TEXT_LENGTH} characters or fewer.`,
    };
  }
  const sanitized = sanitizeTextInput(raw, MAX_FREE_TEXT_LENGTH);
  if (!sanitized) {
    return {
      valid: false,
      sanitized: '',
      error:
        language === 'hi'
          ? 'कृपया अपनी वायु गुणवत्ता योजना से जुड़ा कोई प्रश्न दर्ज करें।'
          : 'Please enter a question about your air quality plan.',
    };
  }
  return { valid: true, sanitized };
}

/**
 * Zod schema for Open-Meteo Geocoding API responses.
 */
export const geocodingResponseSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional().default(''),
        admin1: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});

/**
 * Zod schema for Open-Meteo Air Quality API responses.
 */
export const airQualityResponseSchema = z.object({
  current: z.object({
    time: z.string(),
    us_aqi: z.number().nullish(),
    pm2_5: z.number().nullish(),
    pm10: z.number().nullish(),
    nitrogen_dioxide: z.number().nullish(),
    ozone: z.number().nullish(),
  }),
});

/**
 * Zod schema for a single Gemini recommendation item.
 */
export const recommendationItemSchema = z.object({
  title: z.string().min(1).max(MAX_TIME_WINDOW_LENGTH),
  detail: z.string().min(1).max(MAX_DETAIL_LENGTH),
  whyItHelps: z.string().min(1).max(MAX_WHY_LENGTH),
  estimatedImpact: z.string().min(1).max(MAX_IMPACT_LENGTH),
  timeWindow: z.string().max(MAX_ITEM_TIME_WINDOW_LENGTH).optional(),
});

/**
 * Zod schema for validating the structured JSON ActionPlan from Gemini.
 */
export const actionPlanSchema = z.object({
  summary: z.string().min(1).max(MAX_SUMMARY_LENGTH),
  bestTimeWindow: z.string().min(1).max(MAX_TIME_WINDOW_LENGTH),
  worstTimeWindow: z.string().min(1).max(MAX_TIME_WINDOW_LENGTH),
  dailyRoutine: z.array(recommendationItemSchema).min(1).max(MAX_PLAN_ITEMS_PER_SECTION),
  indoorAirHacks: z.array(recommendationItemSchema).min(1).max(MAX_PLAN_ITEMS_PER_SECTION),
  sustainableAlternatives: z
    .array(recommendationItemSchema)
    .min(1)
    .max(MAX_PLAN_ITEMS_PER_SECTION),
  healthProtection: z.array(recommendationItemSchema).min(1).max(MAX_PLAN_ITEMS_PER_SECTION),
});
