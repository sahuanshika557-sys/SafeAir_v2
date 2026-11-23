import {
  API_TIMEOUT_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from '../constants/index.js';
import type {
  ActionPlan,
  AirQualityReading,
  ChatMessage,
  Language,
  LifestyleProfile,
  LocationData,
} from '../types/index.js';
import { createLinkedTimeoutController } from '../utils/network.js';
import { SlidingWindowRateLimiter } from '../utils/rateLimiter.js';
import { consumeClientRateLimit, extractHttpErrorMessage } from './geminiPayloads.js';
import { requestPersonalizedPlan, resetPlanClientCache } from './geminiPlanService.js';
import { readPlanOrChatResponseBody } from './geminiStream.js';

const AI_STREAM_TIMEOUT_MULTIPLIER = 4;

const clientRateLimiter = new SlidingWindowRateLimiter(
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
);

/**
 * Resets the client-side plan cache, in-flight request map, and sliding-window rate limiter.
 * Intended for deterministic unit and service tests.
 */
export function resetGeminiClientState(): void {
  resetPlanClientCache();
  clientRateLimiter.reset();
}

/**
 * Requests a streamed structured JSON action plan (or automatic non-streaming JSON fallback)
 * from `/api/plan`, deduplicating identical in-flight requests and caching validated plans.
 *
 * @param params - Plan generation inputs, optional progress callback, abort signal, and cache override.
 * @returns Validated four-section {@link ActionPlan} with provenance metadata.
 */
export async function generatePersonalizedPlan(params: {
  location: LocationData;
  airQuality: AirQualityReading;
  profile: LifestyleProfile;
  language: Language;
  onStreamProgress?: (partialText: string) => void;
  signal?: AbortSignal;
  bypassCache?: boolean;
}): Promise<ActionPlan> {
  return requestPersonalizedPlan(clientRateLimiter, params);
}

/** Parameters accepted by {@link streamFollowUpChat}. */
export interface StreamFollowUpChatParams {
  message: string;
  history: readonly ChatMessage[];
  context: {
    locationName: string;
    usAqi: number;
    categoryLabel: string;
    planSummary?: string;
  };
  language: Language;
  onToken: (fullText: string) => void;
  onComplete?: (meta: {
    text: string;
    truncated: boolean;
    finishReason?: string;
    model?: string;
  }) => void;
  signal?: AbortSignal;
}

/**
 * Streams a scoped follow-up chat response (or automatic non-streaming JSON fallback)
 * from `/api/chat`. Reports truncation metadata via optional `onComplete` callback.
 *
 * @param params - Sanitized user question, bounded history, active AQI context, language, stream callback, and completion hook.
 * @returns Full completed assistant reply text.
 */
export async function streamFollowUpChat(params: StreamFollowUpChatParams): Promise<string> {
  consumeClientRateLimit(clientRateLimiter, params.language, 'chat');
  const { controller, cleanup } = createLinkedTimeoutController(
    API_TIMEOUT_MS * AI_STREAM_TIMEOUT_MULTIPLIER,
    params.signal,
  );
  const { message, history, context, language, onToken, onComplete } = params;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, context, language }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(await extractHttpErrorMessage(response, language, 'chat'));
    }
    const { text, truncated, finishReason, model } = await readPlanOrChatResponseBody(
      response,
      onToken,
      language,
      'chat',
    );
    onComplete?.({ text, truncated, finishReason, model });
    return text;
  } finally {
    cleanup();
  }
}
