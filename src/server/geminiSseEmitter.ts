import {
  CHAT_STREAM_FORCE_FLUSH_CHARS,
  CHAT_STREAM_SAFE_BUFFER_CHARS,
  HTTP_OK,
} from '../constants/index.js';
import type { Language } from '../types/index.js';
import {
  classifyUpstreamError,
  extractSafeErrorDiagnostics,
  getLocalizedApiErrorMessage,
} from '../utils/errorDiagnostics.js';
import { isSuspectClaimBuffer } from '../utils/scientificClaimRules.js';
import { sanitizeChatScientificClaims } from '../utils/scientificFilter.js';
import { tryParseValidPlanJson, type FirstChunkStreamResult } from './geminiStream.js';
import { setSecurityHeaders, writeSseEvent, type ServerApiResponse } from './httpUtils.js';

const TRAILING_SUSPECT_FRAGMENT_RE = /\b(?:plant|cloth|scarf|100|99)$/i;

function splitAtFirstSentenceBoundary(text: string): [string, string] | null {
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '।' || ch === '\n') {
      return [text.slice(0, i + 1), text.slice(i + 1)];
    }
  }
  return null;
}

function emitSanitizedChatSegment(
  res: ServerApiResponse,
  segment: string,
  language: Language,
  modelHeader?: string,
): void {
  if (!segment) {
    return;
  }
  const { text: cleaned, flaggedClaims } = sanitizeChatScientificClaims(segment, language);
  if (flaggedClaims.length > 0) {
    console.warn('[SafeAir Saathi] Scientific claim guard adjusted chat output:', {
      count: flaggedClaims.length,
    });
  }
  if (!cleaned) {
    return;
  }
  writeSseEvent(res, modelHeader ? { chunk: cleaned, model: modelHeader } : { chunk: cleaned });
}

function createChatChunkEmitter(
  res: ServerApiResponse,
  language: Language,
  model: string,
): { push: (chunkText: string, flushAll: boolean) => void; hasPending: () => boolean } {
  let buffer = '';
  let sentModelHeader = false;

  const emitChunk = (segment: string): void => {
    emitSanitizedChatSegment(res, segment, language, sentModelHeader ? undefined : model);
    sentModelHeader = true;
  };

  const push = (chunkText: string, flushAll: boolean): void => {
    buffer += chunkText;
    if (flushAll) {
      emitChunk(buffer);
      buffer = '';
      return;
    }
    const isShortSafeBuffer =
      !isSuspectClaimBuffer(buffer) && buffer.length < CHAT_STREAM_SAFE_BUFFER_CHARS;
    if (isShortSafeBuffer) {
      if (!TRAILING_SUSPECT_FRAGMENT_RE.test(buffer)) {
        emitChunk(buffer);
        buffer = '';
      }
      return;
    }
    const boundarySplit = splitAtFirstSentenceBoundary(buffer);
    if (boundarySplit) {
      emitChunk(boundarySplit[0]);
      buffer = boundarySplit[1];
    } else if (buffer.length > CHAT_STREAM_FORCE_FLUSH_CHARS) {
      emitChunk(buffer);
      buffer = '';
    }
  };

  return { push, hasPending: () => buffer.length > 0 };
}

function initSseHeaders(res: ServerApiResponse): void {
  res.statusCode = HTTP_OK;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  setSecurityHeaders(res);
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
}

function finalizeSseStream(
  res: ServerApiResponse,
  options: {
    contextType: 'plan' | 'chat';
    language: Language;
    model: string;
    lastFinishReason?: string;
    accumulatedPlanText: string;
    flushChat: () => void;
  },
): void {
  const truncated = options.lastFinishReason === 'MAX_TOKENS';
  const finishField = options.lastFinishReason ? { finishReason: options.lastFinishReason } : {};
  if (options.contextType === 'chat') {
    options.flushChat();
    writeSseEvent(res, { done: true, model: options.model, truncated, ...finishField });
    return;
  }

  const checkedPlan = tryParseValidPlanJson(options.accumulatedPlanText, options.language);
  if (checkedPlan && checkedPlan.flaggedCount > 0) {
    console.warn('[SafeAir Saathi] Scientific claim guard adjusted streamed plan items:', {
      count: checkedPlan.flaggedCount,
    });
    writeSseEvent(res, {
      replacementText: checkedPlan.json,
      done: true,
      model: options.model,
      truncated,
      ...finishField,
    });
    return;
  }

  writeSseEvent(res, { done: true, model: options.model, truncated, ...finishField });
}

async function drainStreamChunks(
  res: ServerApiResponse,
  streamResult: FirstChunkStreamResult,
  contextType: 'plan' | 'chat',
  chatEmitter: ReturnType<typeof createChatChunkEmitter>,
): Promise<{ accumulatedPlanText: string; lastFinishReason?: string }> {
  let lastFinishReason = streamResult.firstFinishReason;
  let accumulatedPlanText = '';

  if (contextType === 'plan') {
    accumulatedPlanText += streamResult.firstChunk;
    writeSseEvent(res, { chunk: streamResult.firstChunk, model: streamResult.model });
  } else {
    chatEmitter.push(streamResult.firstChunk, false);
  }

  while (true) {
    const step = await streamResult.iterator.next();
    if (step.done) {
      break;
    }
    const chunkFinish = step.value?.candidates?.[0]?.finishReason;
    if (chunkFinish) {
      lastFinishReason = chunkFinish;
    }
    const chunkText = step.value?.text;
    if (!chunkText) {
      continue;
    }
    if (contextType === 'plan') {
      accumulatedPlanText += chunkText;
      writeSseEvent(res, { chunk: chunkText });
    } else {
      chatEmitter.push(chunkText, false);
    }
  }

  return { accumulatedPlanText, lastFinishReason };
}

/**
 * Streams validated Gemini output to an HTTP Server-Sent Events response, including
 * chat-chunk claim sanitization and mid-stream error reporting.
 */
export async function pumpGeminiStreamToSse(
  res: ServerApiResponse,
  streamResult: FirstChunkStreamResult,
  options: {
    routeLabel: '/api/plan' | '/api/chat';
    contextType: 'plan' | 'chat';
    language: Language;
  },
): Promise<void> {
  initSseHeaders(res);
  const chatEmitter = createChatChunkEmitter(res, options.language, streamResult.model);

  try {
    const { accumulatedPlanText, lastFinishReason } = await drainStreamChunks(
      res,
      streamResult,
      options.contextType,
      chatEmitter,
    );
    finalizeSseStream(res, {
      contextType: options.contextType,
      language: options.language,
      model: streamResult.model,
      lastFinishReason,
      accumulatedPlanText,
      flushChat: () => chatEmitter.push('', true),
    });
  } catch (midStreamErr: unknown) {
    if (chatEmitter.hasPending()) {
      chatEmitter.push('', true);
    }
    const { category, httpStatus } = classifyUpstreamError(midStreamErr);
    const diag = extractSafeErrorDiagnostics(midStreamErr);
    console.error(`[SafeAir Saathi] ${options.routeLabel} mid-stream failure:`, {
      category,
      status: httpStatus,
    });
    writeSseEvent(res, {
      error: getLocalizedApiErrorMessage(category, options.language, options.contextType),
      category,
      errorType: diag.errorType,
    });
  } finally {
    res.end();
  }
}
