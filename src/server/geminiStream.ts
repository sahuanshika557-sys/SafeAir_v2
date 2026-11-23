import type { GoogleGenAI, Schema } from '@google/genai';
import type { Language } from '../types/index.js';
import { sanitizePlanScientificClaims } from '../utils/scientificFilter.js';
import { actionPlanSchema } from '../utils/validation.js';
import { buildModelConfig, executeWithModelRetry } from './geminiClient.js';

export { pumpGeminiStreamToSse } from './geminiSseEmitter.js';

/** Parses and validates raw plan JSON from Gemini, applying scientific-claim sanitization. */
export function tryParseValidPlanJson(
  rawText: string,
  language: Language,
): { json: string; flaggedCount: number } | null {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    const validated = actionPlanSchema.safeParse(parsed);
    if (!validated.success) {
      return null;
    }
    const { plan: sanitizedPlan, flaggedClaims } = sanitizePlanScientificClaims(
      validated.data,
      language,
    );
    return { json: JSON.stringify(sanitizedPlan), flaggedCount: flaggedClaims.length };
  } catch {
    return null;
  }
}

/** Normalized shape for an individual streamed Gemini response chunk. */
export interface GeminiStreamChunk {
  text?: string;
  candidates?: Array<{ finishReason?: string }>;
}

/** Validated initial stream state after receiving at least one non-empty text chunk. */
export interface FirstChunkStreamResult {
  firstChunk: string;
  firstFinishReason?: string;
  iterator: AsyncIterator<GeminiStreamChunk>;
  model: string;
}

/** Parameters controlling a streaming or non-streaming Gemini execution. */
export interface GeminiExecutionParams {
  routeLabel: '/api/plan' | '/api/chat';
  contextType: 'plan' | 'chat';
  language: Language;
  contents: string;
  systemInstruction: string;
  responseSchema?: Schema;
}

async function consumeFirstStreamChunk(
  iterator: AsyncIterator<GeminiStreamChunk>,
  model: string,
): Promise<FirstChunkStreamResult> {
  let firstFinishReason: string | undefined;

  while (true) {
    const next = await iterator.next();
    if (next.done) {
      throw new Error('Empty stream response from Gemini.');
    }
    const chunkFinish = next.value?.candidates?.[0]?.finishReason;
    if (chunkFinish) {
      firstFinishReason = chunkFinish;
    }
    if (next.value?.text) {
      return { firstChunk: next.value.text, firstFinishReason, iterator, model };
    }
  }
}

/**
 * Opens a Gemini streaming iterator and validates that at least one non-empty chunk arrives
 * before sending SSE response headers to the client.
 */
export async function openValidatedStreamWithRetry(
  ai: Pick<GoogleGenAI, 'models'>,
  params: {
    routeLabel: '/api/plan' | '/api/chat';
    contents: string;
    systemInstruction: string;
    responseSchema?: Schema;
    signal: AbortSignal;
  },
): Promise<FirstChunkStreamResult> {
  return executeWithModelRetry(
    { routeLabel: params.routeLabel, attemptLabel: 'stream', signal: params.signal },
    async (model) => {
      const stream = await ai.models.generateContentStream({
        model,
        contents: params.contents,
        config: buildModelConfig(
          model,
          params.systemInstruction,
          params.responseSchema,
          params.signal,
        ),
      });
      return consumeFirstStreamChunk(stream[Symbol.asyncIterator](), model);
    },
  );
}

/**
 * Executes a non-streaming `generateContent` call with model fallback and retry backoff.
 */
export async function generateNonStreamingWithRetry(
  ai: Pick<GoogleGenAI, 'models'>,
  params: {
    routeLabel: '/api/plan' | '/api/chat';
    contents: string;
    systemInstruction: string;
    responseSchema?: Schema;
    signal: AbortSignal;
  },
): Promise<{ text: string; model: string; finishReason?: string }> {
  return executeWithModelRetry(
    { routeLabel: params.routeLabel, attemptLabel: 'generateContent', signal: params.signal },
    async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: buildModelConfig(
          model,
          params.systemInstruction,
          params.responseSchema,
          params.signal,
        ),
      });
      const text = (response.text ?? '').trim();
      if (!text) {
        throw new Error('Empty response from Gemini.');
      }
      const finishReason = response.candidates?.[0]?.finishReason;
      return { text, model, finishReason };
    },
  );
}
