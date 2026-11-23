import { randomInt } from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, type Schema } from '@google/genai';
import {
  CHAT_MAX_OUTPUT_TOKENS,
  LEGACY_GEMINI_TEMPERATURE,
  MAX_MODEL_RETRY_ATTEMPTS,
  PLAN_MAX_OUTPUT_TOKENS,
  SERVER_RETRY_BASE_DELAY_MS,
} from '../constants/index.js';
import { classifyUpstreamError, isDefinitiveKeyFailure } from '../utils/errorDiagnostics.js';
import { getConfiguredGeminiApiKey, getGeminiModelCandidates } from './env.js';
import { geminiSafetySettings } from './schemas.js';

const HEALTH_PROBE_MAX_TOKENS = 16;
const RETRY_JITTER_RATIO = 0.4;
const BACKOFF_EXPONENT_BASE = 2;

/**
 * Dependency-injection overrides intended purely for unit/integration testing of retry,
 * fallback, and error classification paths without touching production behavior.
 */
export interface ServerAiTestOverrides {
  aiClient?: Pick<GoogleGenAI, 'models'>;
  retryDelayBaseMs?: number;
  totalTimeoutMs?: number;
}

let aiTestOverrides: ServerAiTestOverrides | null = null;

/**
 * Registers or clears test overrides for server Gemini calls (testing only).
 *
 * @param overrides - Mock `@google/genai` models object and fast retry timings, or `null` to reset.
 */
export function setServerAiTestOverrides(overrides: ServerAiTestOverrides | null): void {
  aiTestOverrides = overrides;
}

/**
 * Returns the active test overrides for server Gemini calls, or `null` in production.
 */
export function getAiTestOverrides(): ServerAiTestOverrides | null {
  return aiTestOverrides;
}

/**
 * Creates a `@google/genai` models client from test overrides or validated server env config.
 */
export function createGeminiClient(): Pick<GoogleGenAI, 'models'> | null {
  if (aiTestOverrides?.aiClient) {
    return aiTestOverrides.aiClient;
  }
  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return client.models ? { models: client.models } : null;
}

function isGemini3Or4Model(model: string): boolean {
  return /^gemini-[34]/i.test(model);
}

/**
 * Builds minimal Gemini model configuration for `GET /api/health?probe=1` readiness checks.
 */
export function buildHealthProbeModelConfig(model: string, abortSignal: AbortSignal) {
  return {
    abortSignal,
    ...(isGemini3Or4Model(model)
      ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
      : { maxOutputTokens: HEALTH_PROBE_MAX_TOKENS }),
  };
}

/**
 * Builds model-aware Gemini generation configuration for plan and chat endpoints.
 */
export function buildModelConfig(
  model: string,
  systemInstruction: string,
  responseSchema: Schema | undefined,
  abortSignal: AbortSignal,
) {
  const isLiteModel = /flash-lite/i.test(model);
  return {
    systemInstruction,
    safetySettings: geminiSafetySettings,
    abortSignal,
    maxOutputTokens: responseSchema ? PLAN_MAX_OUTPUT_TOKENS : CHAT_MAX_OUTPUT_TOKENS,
    ...(isGemini3Or4Model(model)
      ? {
          thinkingConfig: {
            thinkingLevel: isLiteModel ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
          },
        }
      : {
          temperature: LEGACY_GEMINI_TEMPERATURE,
        }),
    ...(responseSchema
      ? {
          responseMimeType: 'application/json',
          responseSchema,
        }
      : {}),
  };
}

async function delayWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      globalThis.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function computeRetryDelayMs(baseDelay: number, attempt: number): number {
  const maxJitter = Math.max(1, Math.round(baseDelay * RETRY_JITTER_RATIO));
  const jitter = randomInt(0, maxJitter + 1);
  return baseDelay * Math.pow(BACKOFF_EXPONENT_BASE, attempt) + jitter;
}

interface RetryAttemptParams {
  routeLabel: '/api/plan' | '/api/chat';
  attemptLabel: 'stream' | 'generateContent';
  signal: AbortSignal;
}

async function handleModelAttemptError(
  model: string,
  attempt: number,
  err: unknown,
  baseDelay: number,
  params: RetryAttemptParams,
): Promise<'retry' | 'next_model'> {
  const { category, httpStatus, retryable } = classifyUpstreamError(err);
  console.error(
    `[SafeAir Saathi] ${params.routeLabel} ${params.attemptLabel} attempt failed:`,
    { model, attempt: attempt + 1, category, status: httpStatus },
  );
  if (category === 'bad_request' || isDefinitiveKeyFailure(err)) {
    throw err;
  }
  if (category === 'model_unavailable' || category === 'invalid_key') {
    return 'next_model';
  }
  if (retryable && attempt < MAX_MODEL_RETRY_ATTEMPTS - 1) {
    await delayWithAbort(computeRetryDelayMs(baseDelay, attempt), params.signal);
    return 'retry';
  }
  return 'next_model';
}

async function tryModelWithRetries<T>(
  model: string,
  baseDelay: number,
  params: RetryAttemptParams,
  attemptFn: (model: string) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_MODEL_RETRY_ATTEMPTS; attempt += 1) {
    if (params.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      return { ok: true, value: await attemptFn(model) };
    } catch (err: unknown) {
      lastError = err;
      const disposition = await handleModelAttemptError(model, attempt, err, baseDelay, params);
      if (disposition === 'next_model') {
        break;
      }
    }
  }
  return { ok: false, error: lastError };
}

/**
 * Executes an async Gemini SDK attempt across the ordered model fallback chain with bounded
 * exponential backoff for retryable transient errors.
 */
export async function executeWithModelRetry<T>(
  params: {
    routeLabel: '/api/plan' | '/api/chat';
    attemptLabel: 'stream' | 'generateContent';
    signal: AbortSignal;
  },
  attemptFn: (model: string) => Promise<T>,
): Promise<T> {
  const baseDelay = aiTestOverrides?.retryDelayBaseMs ?? SERVER_RETRY_BASE_DELAY_MS;
  const models = getGeminiModelCandidates();
  let lastError: unknown;

  for (const model of models) {
    const result = await tryModelWithRetries(model, baseDelay, params, attemptFn);
    if (result.ok) {
      return result.value;
    }
    lastError = result.error;
  }

  throw lastError ?? new Error(`All Gemini ${params.attemptLabel} attempts failed.`);
}
