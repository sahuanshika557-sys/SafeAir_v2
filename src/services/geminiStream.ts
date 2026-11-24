import type { Language } from '../types/index.js';
import {
  nonStreamingJsonResponseSchema,
  resolveCategoryErrorMessage,
  sseEventPayloadSchema,
} from './geminiPayloads.js';

const SSE_DATA_PREFIX = 'data: ';

/** Parsed AI generation response metadata and accumulated text. */
export interface ParsedAiResponseBody {
  text: string;
  model?: string;
  truncated: boolean;
  finishReason?: string;
}

interface SseStreamState {
  accumulated: string;
  modelUsed?: string;
  sawDone: boolean;
  truncated: boolean;
  finishReason?: string;
}

interface ParsedSseEventPayload {
  model?: string;
  error?: string;
  errorType?: string;
  category?: string;
  replacementText?: string;
  chunk?: string;
  done?: boolean;
  truncated?: boolean;
  finishReason?: string;
}

function applyParsedSseEvent(
  event: ParsedSseEventPayload,
  state: SseStreamState,
  onChunk: (text: string) => void,
  language: Language,
  serviceType: 'plan' | 'chat',
): void {
  if (event.model) {
    state.modelUsed = event.model;
  }
  if (event.error) {
    if (event.errorType) {
      console.warn('[SafeAir Saathi] AI stream failed:', { errorType: event.errorType });
    }
    const localized = resolveCategoryErrorMessage(
      event.category,
      event.error,
      language,
      serviceType,
    );
    throw new Error(localized ?? event.error);
  }
  if (event.replacementText) {
    state.accumulated = event.replacementText;
    onChunk(state.accumulated);
  } else if (event.chunk) {
    state.accumulated += event.chunk;
    onChunk(state.accumulated);
  }
  if (event.done) {
    state.sawDone = true;
    state.truncated = Boolean(event.truncated || event.finishReason === 'MAX_TOKENS');
    if (event.finishReason) {
      state.finishReason = event.finishReason;
    }
  }
}

function applySseEventLine(
  rawEvent: string,
  state: SseStreamState,
  onChunk: (text: string) => void,
  language: Language,
  serviceType: 'plan' | 'chat',
): void {
  const dataLine = rawEvent.split('\n').find((line) => line.startsWith(SSE_DATA_PREFIX));
  const payloadStr = dataLine ? dataLine.slice(SSE_DATA_PREFIX.length).trim() : '';
  if (!payloadStr) {
    return;
  }
  const rawJson: unknown = JSON.parse(payloadStr);
  const parsedResult = sseEventPayloadSchema.safeParse(rawJson);
  if (parsedResult.success) {
    applyParsedSseEvent(parsedResult.data, state, onChunk, language, serviceType);
  }
}

/**
 * Parses Server-Sent Events lines from a fetch `ReadableStream` and forwards accumulated chunks,
 * tracking server truncation metadata (`MAX_TOKENS` or unexpected mid-stream close).
 */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
  language: Language,
  serviceType: 'plan' | 'chat',
): Promise<ParsedAiResponseBody> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const state: SseStreamState = {
    accumulated: '',
    sawDone: false,
    truncated: false,
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const rawEvent of events) {
      applySseEventLine(rawEvent, state, onChunk, language, serviceType);
    }
  }

  if (!state.sawDone && state.accumulated.trim().length > 0) {
    state.truncated = true;
  }

  return {
    text: state.accumulated,
    model: state.modelUsed,
    truncated: state.truncated,
    finishReason: state.finishReason,
  };
}

/**
 * Reads either a non-streaming JSON payload, an SSE stream, or plain-text fallback body
 * from `/api/plan` or `/api/chat`.
 */
export async function readPlanOrChatResponseBody(
  response: Response,
  onProgress: (text: string) => void,
  language: Language,
  serviceType: 'plan' | 'chat',
): Promise<ParsedAiResponseBody> {
  const contentType = response.headers?.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const rawPayload: unknown = await response.json();
    const parsed = nonStreamingJsonResponseSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return { text: '', truncated: false };
    }
    const payload = parsed.data;
    if (payload.error) {
      const msg = resolveCategoryErrorMessage(
        payload.category,
        payload.error,
        language,
        serviceType,
      );
      throw new Error(msg ?? payload.error);
    }
    const text = payload.text ?? '';
    if (text) {
      onProgress(text);
    }
    return {
      text,
      model: payload.model,
      truncated: Boolean(payload.truncated || payload.finishReason === 'MAX_TOKENS'),
      finishReason: payload.finishReason,
    };
  }

  if (response.body) {
    return readSseStream(response.body, onProgress, language, serviceType);
  }

  const text = await response.text();
  if (text) {
    onProgress(text);
  }
  return { text, truncated: false };
}
