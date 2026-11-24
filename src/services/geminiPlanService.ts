import {
  API_TIMEOUT_MS,
  PLAN_CACHE_TTL_MS,
  PLAN_REPAIR_CLIENT_SLICE_LENGTH,
} from '../constants/index.js';
import type {
  ActionPlan,
  AirQualityReading,
  Language,
  LifestyleProfile,
  LocationData,
} from '../types/index.js';
import { buildPlanCacheKey, TtlCache } from '../utils/cache.js';
import { createLinkedTimeoutController, isAbortError } from '../utils/network.js';
import type { SlidingWindowRateLimiter } from '../utils/rateLimiter.js';
import {
  consumeClientRateLimit,
  extractHttpErrorMessage,
  parseAndValidatePlanText,
} from './geminiPayloads.js';
import { readPlanOrChatResponseBody } from './geminiStream.js';

const AI_STREAM_TIMEOUT_MULTIPLIER = 4;

interface InFlightPlanEntry {
  promise: Promise<ActionPlan>;
  controller: AbortController;
  subscribers: number;
  progressListeners: Set<(partialText: string) => void>;
}

interface PlanRequestInputs {
  location: LocationData;
  airQuality: AirQualityReading;
  profile: LifestyleProfile;
  language: Language;
  onStreamProgress?: (partialText: string) => void;
  signal?: AbortSignal;
  bypassCache?: boolean;
}

type PlanContextInputs = Pick<
  PlanRequestInputs,
  'location' | 'airQuality' | 'profile' | 'language'
>;

const planCache = new TtlCache<ActionPlan>(PLAN_CACHE_TTL_MS);
const inFlightPlanRequests = new Map<string, InFlightPlanEntry>();

/** Clears the client-side plan cache and active in-flight deduplication map. */
export function resetPlanClientCache(): void {
  planCache.clear();
  inFlightPlanRequests.clear();
}

async function subscribeToInFlightPlan(
  existing: InFlightPlanEntry,
  onStreamProgress?: (partialText: string) => void,
  signal?: AbortSignal,
): Promise<ActionPlan> {
  existing.subscribers += 1;
  if (onStreamProgress) {
    existing.progressListeners.add(onStreamProgress);
  }
  const onCallerAbort = (): void => {
    existing.subscribers = Math.max(0, existing.subscribers - 1);
    if (onStreamProgress) {
      existing.progressListeners.delete(onStreamProgress);
    }
    if (existing.subscribers === 0) {
      existing.controller.abort();
    }
  };
  if (signal?.aborted) {
    onCallerAbort();
    throw new DOMException('Aborted', 'AbortError');
  }
  signal?.addEventListener('abort', onCallerAbort, { once: true });
  try {
    return await existing.promise;
  } finally {
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

async function attemptPlanJsonRepair(
  malformedText: string,
  params: PlanContextInputs,
  signal: AbortSignal,
): Promise<ActionPlan | null> {
  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...params,
        stream: false,
        repairPreviousMalformed: malformedText.slice(0, PLAN_REPAIR_CLIENT_SLICE_LENGTH),
      }),
      signal,
    });
    if (!response || !response.ok) {
      return null;
    }
    const { text, model } = await readPlanOrChatResponseBody(
      response,
      () => {},
      params.language,
      'plan',
    );
    return parseAndValidatePlanText(text, { ...params, modelUsed: model });
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw err;
    }
    return null;
  }
}

async function parseOrRepairPlan(
  rawJsonText: string,
  model: string | undefined,
  inputs: PlanContextInputs,
  signal: AbortSignal,
): Promise<ActionPlan> {
  const initialPlan = parseAndValidatePlanText(rawJsonText, { ...inputs, modelUsed: model });
  const validPlan =
    initialPlan ??
    (rawJsonText.trim() ? await attemptPlanJsonRepair(rawJsonText, inputs, signal) : null);
  if (!validPlan) {
    throw new Error(
      inputs.language === 'hi'
        ? 'AI प्रतिक्रिया अधूरी या अमान्य थी। कृपया पुनः प्रयास करें।'
        : 'The AI response was incomplete or malformed. Please retry.',
    );
  }
  return validPlan;
}

async function fetchAndValidatePlan(
  inputs: PlanContextInputs,
  cacheKey: string,
  controller: AbortController,
  cleanup: () => void,
  progressListeners: ReadonlySet<(partialText: string) => void>,
): Promise<ActionPlan> {
  try {
    const { location, airQuality, profile, language } = inputs;
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, airQuality, profile, language }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(await extractHttpErrorMessage(response, language, 'plan'));
    }
    const notifyProgress = (acc: string): void => {
      for (const listener of progressListeners) {
        listener(acc);
      }
    };
    const { text: rawJsonText, model } = await readPlanOrChatResponseBody(
      response,
      notifyProgress,
      language,
      'plan',
    );
    const validPlan = await parseOrRepairPlan(rawJsonText, model, inputs, controller.signal);
    planCache.set(cacheKey, validPlan);
    return validPlan;
  } finally {
    inFlightPlanRequests.delete(cacheKey);
    cleanup();
  }
}

/**
 * Executes a streamed `/api/plan` request with deduplication, optional repair, and caching.
 */
export async function requestPersonalizedPlan(
  rateLimiter: SlidingWindowRateLimiter,
  params: PlanRequestInputs,
): Promise<ActionPlan> {
  const { location, airQuality, profile, language, onStreamProgress, signal, bypassCache } = params;
  const cacheKey = buildPlanCacheKey(location, airQuality.category.key, profile, language);

  if (!bypassCache) {
    const cached = planCache.get(cacheKey);
    if (cached && cached.generatedForAqi === airQuality.usAqi) {
      return cached;
    }
    const existing = inFlightPlanRequests.get(cacheKey);
    if (existing && !existing.controller.signal.aborted) {
      return subscribeToInFlightPlan(existing, onStreamProgress, signal);
    }
  }

  consumeClientRateLimit(rateLimiter, language, 'plan');
  const { controller, cleanup } = createLinkedTimeoutController(
    API_TIMEOUT_MS * AI_STREAM_TIMEOUT_MULTIPLIER,
    signal,
  );
  const progressListeners = new Set<(partialText: string) => void>();
  if (onStreamProgress) {
    progressListeners.add(onStreamProgress);
  }

  const promise = fetchAndValidatePlan(
    { location, airQuality, profile, language },
    cacheKey,
    controller,
    cleanup,
    progressListeners,
  );
  if (!bypassCache) {
    inFlightPlanRequests.set(cacheKey, { promise, controller, subscribers: 1, progressListeners });
  }
  return promise;
}
