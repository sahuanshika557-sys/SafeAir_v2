import { z } from 'zod';
import {
  HTTP_FORBIDDEN,
  HTTP_GATEWAY_TIMEOUT,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_UNAUTHORIZED,
  MS_PER_SECOND,
} from '../constants/index.js';
import type {
  ActionPlan,
  AirQualityReading,
  ApiErrorCategory,
  Language,
  LifestyleProfile,
  LocationData,
} from '../types/index.js';
import { getLocalizedApiErrorMessage } from '../utils/errorDiagnostics.js';
import { sanitizeActionPlanImpact } from '../utils/impactCalculator.js';
import type { SlidingWindowRateLimiter } from '../utils/rateLimiter.js';
import { sanitizePlanScientificClaims } from '../utils/scientificFilter.js';
import { actionPlanSchema } from '../utils/validation.js';

/** Zod schema matching safe server error taxonomy categories. */
export const apiErrorCategorySchema = z.enum([
  'missing_key',
  'invalid_key',
  'quota_exceeded',
  'model_unavailable',
  'timeout',
  'bad_request',
  'upstream_error',
]);

/** Zod schema for structured JSON error responses returned by `/api/plan` and `/api/chat`. */
export const apiErrorResponseSchema = z.object({
  error: z.string().optional(),
  category: z.string().optional(),
});

/** Zod schema for parsed Server-Sent Event data frames emitted by Gemini endpoints. */
export const sseEventPayloadSchema = z.object({
  chunk: z.string().optional(),
  replacementText: z.string().optional(),
  error: z.string().optional(),
  errorType: z.string().optional(),
  category: z.string().optional(),
  model: z.string().optional(),
  done: z.boolean().optional(),
  truncated: z.boolean().optional(),
  finishReason: z.string().optional(),
});

/** Zod schema for non-streaming JSON fallback responses from Gemini endpoints. */
export const nonStreamingJsonResponseSchema = z.object({
  text: z.string().optional(),
  model: z.string().optional(),
  truncated: z.boolean().optional(),
  finishReason: z.string().optional(),
  error: z.string().optional(),
  category: z.string().optional(),
});

/**
 * Safely maps an untrusted error category string and optional raw message into a localized
 * client error message without using unchecked type assertions.
 */
export function resolveCategoryErrorMessage(
  rawCategory: string | undefined,
  rawError: string | undefined,
  language: Language,
  serviceType: 'plan' | 'chat',
): string | null {
  const parsedCategory = apiErrorCategorySchema.safeParse(rawCategory);
  if (parsedCategory.success) {
    const category: ApiErrorCategory = parsedCategory.data;
    return getLocalizedApiErrorMessage(category, language, serviceType);
  }
  if (rawError) {
    return rawError;
  }
  return null;
}

/**
 * Enforces the client-side sliding-window rate limit before invoking `/api/plan` or `/api/chat`.
 */
export function consumeClientRateLimit(
  limiter: SlidingWindowRateLimiter,
  language: Language,
  actionType: 'plan' | 'chat',
): void {
  const rateCheck = limiter.consume();
  if (rateCheck.allowed) {
    return;
  }
  const waitSeconds = Math.max(1, Math.ceil(rateCheck.retryAfterMs / MS_PER_SECOND));
  if (language === 'hi') {
    const suffix = actionType === 'plan' ? 'पुनः प्रयास करें' : 'पूछें';
    throw new Error(`अनुरोध सीमा पूरी हो गई है। कृपया ${waitSeconds} सेकंड बाद ${suffix}।`);
  }
  const suffix = actionType === 'plan' ? 'trying again' : 'asking again';
  throw new Error(`Rate limit reached. Please wait ${waitSeconds}s before ${suffix}.`);
}

/**
 * Extracts a safe, localized user-facing error message from a failed HTTP `Response`.
 */
export async function extractHttpErrorMessage(
  response: Response,
  language: Language,
  serviceType: 'plan' | 'chat',
): Promise<string> {
  const rawBody: unknown = await response.json().catch(() => ({}));
  const parsed = apiErrorResponseSchema.safeParse(rawBody);
  if (parsed.success) {
    const parsedCategory = apiErrorCategorySchema.safeParse(parsed.data.category);
    if (parsedCategory.success) {
      return getLocalizedApiErrorMessage(parsedCategory.data, language, serviceType);
    }
    if (parsed.data.error && !/\bhttp\s*\d{3}\b/i.test(parsed.data.error)) {
      return parsed.data.error;
    }
  }

  const statusCategoryMap: Record<number, ApiErrorCategory> = {
    [HTTP_UNAUTHORIZED]: 'invalid_key',
    [HTTP_FORBIDDEN]: 'invalid_key',
    [HTTP_TOO_MANY_REQUESTS]: 'quota_exceeded',
    [HTTP_SERVICE_UNAVAILABLE]: 'model_unavailable',
    [HTTP_GATEWAY_TIMEOUT]: 'timeout',
  };
  const fallbackCategory = statusCategoryMap[response.status] ?? 'upstream_error';
  return getLocalizedApiErrorMessage(fallbackCategory, language, serviceType);
}

/**
 * Parses, validates via Zod, sanitizes scientific claims, and attaches provenance metadata to
 * a raw Gemini JSON action plan string.
 */
export function parseAndValidatePlanText(
  rawText: string,
  meta: {
    location: LocationData;
    airQuality: AirQualityReading;
    profile: LifestyleProfile;
    language: Language;
    modelUsed?: string;
  },
): ActionPlan | null {
  const cleanedJson = rawText
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanedJson);
  } catch {
    return null;
  }

  const validated = actionPlanSchema.safeParse(parsedJson);
  if (!validated.success) {
    return null;
  }

  const basePlan: ActionPlan = {
    ...validated.data,
    generatedAt: new Date().toISOString(),
    isFallback: false,
    generatedForLocationId: meta.location.id,
    generatedForLocationName: [meta.location.name, meta.location.country]
      .filter(Boolean)
      .join(', '),
    generatedForAqi: meta.airQuality.usAqi,
    generatedForCategoryKey: meta.airQuality.category.key,
    generatedForLanguage: meta.language,
    generatedForProfile: meta.profile,
    modelUsed: meta.modelUsed,
  };

  const { plan: scientificPlan } = sanitizePlanScientificClaims(basePlan, meta.language);
  return sanitizeActionPlanImpact(scientificPlan, meta.language);
}
