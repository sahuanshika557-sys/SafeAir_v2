import type { GoogleGenAI, Schema } from '@google/genai';
import {
  HTTP_BAD_GATEWAY,
  HTTP_OK,
  HTTP_SERVICE_UNAVAILABLE,
  SERVER_GEMINI_TOTAL_TIMEOUT_MS,
} from '../constants/index.js';
import type { ApiErrorCategory, Language } from '../types/index.js';
import { classifyUpstreamError, getLocalizedApiErrorMessage } from '../utils/errorDiagnostics.js';
import { createLinkedTimeoutController } from '../utils/network.js';
import { buildPlanRepairUserPrompt } from '../utils/promptBuilder.js';
import { sanitizeChatScientificClaims } from '../utils/scientificFilter.js';
import { createGeminiClient, getAiTestOverrides } from './geminiClient.js';
import {
  generateNonStreamingWithRetry,
  openValidatedStreamWithRetry,
  pumpGeminiStreamToSse,
  tryParseValidPlanJson,
  type GeminiExecutionParams,
} from './geminiStream.js';
import { sendJson, type ServerApiResponse } from './httpUtils.js';

export {
  buildHealthProbeModelConfig,
  createGeminiClient,
  getAiTestOverrides,
  setServerAiTestOverrides,
  type ServerAiTestOverrides,
} from './geminiClient.js';
export {
  getGeminiModelCandidates,
  getPrimaryGeminiModel,
  hasConfiguredGeminiKey,
} from './env.js';

async function sendNonStreamingPlanResponse(
  ai: Pick<GoogleGenAI, 'models'>,
  res: ServerApiResponse,
  generated: { text: string; model: string; finishReason?: string },
  options: GeminiExecutionParams & { signal: AbortSignal },
): Promise<void> {
  const truncated = generated.finishReason === 'MAX_TOKENS';
  let validPlan = tryParseValidPlanJson(generated.text, options.language);
  if (!validPlan) {
    const repair = await generateNonStreamingWithRetry(ai, {
      routeLabel: options.routeLabel,
      contents: buildPlanRepairUserPrompt(generated.text, options.language),
      systemInstruction: options.systemInstruction,
      responseSchema: options.responseSchema,
      signal: options.signal,
    });
    validPlan = tryParseValidPlanJson(repair.text, options.language);
  }

  if (!validPlan) {
    sendJson(res, HTTP_BAD_GATEWAY, {
      error: getLocalizedApiErrorMessage('upstream_error', options.language, 'plan'),
      category: 'upstream_error' satisfies ApiErrorCategory,
    });
    return;
  }

  if (validPlan.flaggedCount > 0) {
    console.warn('[SafeAir Saathi] Scientific claim guard adjusted non-streaming plan:', {
      count: validPlan.flaggedCount,
    });
  }

  sendJson(res, HTTP_OK, {
    text: validPlan.json,
    model: generated.model,
    nonStreaming: true,
    truncated,
    ...(generated.finishReason ? { finishReason: generated.finishReason } : {}),
  });
}

function sendNonStreamingChatResponse(
  res: ServerApiResponse,
  generated: { text: string; model: string; finishReason?: string },
  language: Language,
): void {
  const truncated = generated.finishReason === 'MAX_TOKENS';
  const { text: sanitizedChatText, flaggedClaims } = sanitizeChatScientificClaims(
    generated.text,
    language,
  );
  if (flaggedClaims.length > 0) {
    console.warn('[SafeAir Saathi] Scientific claim guard adjusted non-streaming chat:', {
      count: flaggedClaims.length,
    });
  }

  sendJson(res, HTTP_OK, {
    text: sanitizedChatText,
    model: generated.model,
    nonStreaming: true,
    truncated,
    ...(generated.finishReason ? { finishReason: generated.finishReason } : {}),
  });
}

interface GeminiHandlerOptions {
  routeLabel: '/api/plan' | '/api/chat';
  contextType: 'plan' | 'chat';
  language: Language;
  preferNonStreaming: boolean;
  contents: string;
  systemInstruction: string;
  responseSchema?: Schema;
}

async function executeStreamOrFallback(
  ai: Pick<GoogleGenAI, 'models'>,
  res: ServerApiResponse,
  options: GeminiHandlerOptions,
  signal: AbortSignal,
): Promise<void> {
  if (!options.preferNonStreaming) {
    try {
      const streamResult = await openValidatedStreamWithRetry(ai, {
        routeLabel: options.routeLabel,
        contents: options.contents,
        systemInstruction: options.systemInstruction,
        responseSchema: options.responseSchema,
        signal,
      });
      await pumpGeminiStreamToSse(res, streamResult, options);
      return;
    } catch (streamStartErr: unknown) {
      const { category } = classifyUpstreamError(streamStartErr);
      if (category === 'invalid_key' || category === 'bad_request' || signal.aborted) {
        throw streamStartErr;
      }
    }
  }

  const generated = await generateNonStreamingWithRetry(ai, {
    routeLabel: options.routeLabel,
    contents: options.contents,
    systemInstruction: options.systemInstruction,
    responseSchema: options.responseSchema,
    signal,
  });

  if (options.contextType === 'plan') {
    await sendNonStreamingPlanResponse(ai, res, generated, { ...options, signal });
    return;
  }
  sendNonStreamingChatResponse(res, generated, options.language);
}

/**
 * Executes a Gemini generation request (`/api/plan` or `/api/chat`) over SSE with first-chunk
 * validation, ordered fallback models, scientific claim sanitization, and non-streaming recovery.
 */
export async function handleGeminiResponse(
  res: ServerApiResponse,
  options: GeminiHandlerOptions,
): Promise<void> {
  const ai = createGeminiClient();
  if (!ai) {
    console.error(`[SafeAir Saathi] ${options.routeLabel} unavailable:`, {
      category: 'missing_key',
      status: HTTP_SERVICE_UNAVAILABLE,
    });
    sendJson(res, HTTP_SERVICE_UNAVAILABLE, {
      error: getLocalizedApiErrorMessage('missing_key', options.language, options.contextType),
      category: 'missing_key' satisfies ApiErrorCategory,
    });
    return;
  }

  const totalBudget = getAiTestOverrides()?.totalTimeoutMs ?? SERVER_GEMINI_TOTAL_TIMEOUT_MS;
  const { controller, cleanup } = createLinkedTimeoutController(totalBudget);
  const onResClose = (): void => {
    if (!res.writableEnded) {
      controller.abort();
    }
  };
  res.on?.('close', onResClose);

  try {
    await executeStreamOrFallback(ai, res, options, controller.signal);
  } catch (err: unknown) {
    const { category, httpStatus } = classifyUpstreamError(err);
    console.error(`[SafeAir Saathi] ${options.routeLabel} failed:`, { category, status: httpStatus });
    sendJson(res, httpStatus, {
      error: getLocalizedApiErrorMessage(category, options.language, options.contextType),
      category,
    });
  } finally {
    res.off?.('close', onResClose);
    cleanup();
  }
}
