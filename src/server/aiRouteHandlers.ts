import { HTTP_BAD_REQUEST, MAX_FREE_TEXT_LENGTH } from '../constants/index.js';
import type { ApiErrorCategory } from '../types/index.js';
import { getLocalizedApiErrorMessage } from '../utils/errorDiagnostics.js';
import {
  buildChatSystemInstruction,
  buildChatUserPrompt,
  buildPlanRepairUserPrompt,
  buildPlanSystemInstruction,
  buildPlanUserPrompt,
} from '../utils/promptBuilder.js';
import { sanitizeTextInput } from '../utils/validation.js';
import { handleGeminiResponse } from './geminiRunner.js';
import { sendJson, type ServerApiRequest, type ServerApiResponse } from './httpUtils.js';
import { parseRateLimitedPostBody, runApiRoute, shouldPreferNonStreaming } from './routeHelpers.js';
import { actionPlanResponseSchema, chatRequestSchema, planRequestSchema } from './schemas.js';

async function executePlanBody(req: ServerApiRequest, res: ServerApiResponse): Promise<void> {
  const bodyResult = await parseRateLimitedPostBody(req, res, {
    contextType: 'plan',
    invalidJsonMessage: 'Invalid JSON request payload for plan generation.',
  });
  if (!bodyResult.ok) {
    return;
  }
  const parsed = planRequestSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    sendJson(res, HTTP_BAD_REQUEST, {
      error: 'Invalid request payload for plan generation.',
      category: 'bad_request' satisfies ApiErrorCategory,
    });
    return;
  }

  const { location, airQuality, profile, language, stream, repairPreviousMalformed } = parsed.data;
  const contents = repairPreviousMalformed
    ? buildPlanRepairUserPrompt(repairPreviousMalformed, language)
    : buildPlanUserPrompt(location, airQuality, profile, language);

  await handleGeminiResponse(res, {
    routeLabel: '/api/plan',
    contextType: 'plan',
    language,
    preferNonStreaming: shouldPreferNonStreaming(req, stream, Boolean(repairPreviousMalformed)),
    contents,
    systemInstruction: buildPlanSystemInstruction(language),
    responseSchema: actionPlanResponseSchema,
  });
}

async function executeChatBody(req: ServerApiRequest, res: ServerApiResponse): Promise<void> {
  const bodyResult = await parseRateLimitedPostBody(req, res, {
    contextType: 'chat',
    invalidJsonMessage: 'Invalid JSON chat request payload.',
  });
  if (!bodyResult.ok) {
    return;
  }
  const parsed = chatRequestSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    sendJson(res, HTTP_BAD_REQUEST, {
      error: 'Invalid chat message or context.',
      category: 'bad_request' satisfies ApiErrorCategory,
    });
    return;
  }

  const sanitizedMessage = sanitizeTextInput(parsed.data.message, MAX_FREE_TEXT_LENGTH);
  if (!sanitizedMessage) {
    sendJson(res, HTTP_BAD_REQUEST, {
      error: 'Please enter a valid question.',
      category: 'bad_request' satisfies ApiErrorCategory,
    });
    return;
  }

  await handleGeminiResponse(res, {
    routeLabel: '/api/chat',
    contextType: 'chat',
    language: parsed.data.language,
    preferNonStreaming: shouldPreferNonStreaming(req, parsed.data.stream),
    contents: buildChatUserPrompt(sanitizedMessage, parsed.data.history, parsed.data.context),
    systemInstruction: buildChatSystemInstruction(parsed.data.language),
  });
}

/**
 * Shared handler for `POST /api/plan` streaming structured 4-section plans via SSE with
 * automatic non-streaming JSON fallback, retry with backoff, and category-based errors.
 */
export async function handlePlanRequest(
  req: ServerApiRequest,
  res: ServerApiResponse,
): Promise<void> {
  await runApiRoute(
    req,
    res,
    {
      allowedMethod: 'POST',
      routeLabel: '/api/plan',
      onError: (category, httpStatus) =>
        sendJson(res, httpStatus, {
          error: getLocalizedApiErrorMessage(category, 'en', 'plan'),
          category,
        }),
    },
    () => executePlanBody(req, res),
  );
}

/**
 * Shared handler for `POST /api/chat` streaming scoped follow-up replies via SSE with
 * automatic non-streaming JSON fallback and category-based errors.
 */
export async function handleChatRequest(
  req: ServerApiRequest,
  res: ServerApiResponse,
): Promise<void> {
  await runApiRoute(
    req,
    res,
    {
      allowedMethod: 'POST',
      routeLabel: '/api/chat',
      onError: (category, httpStatus) =>
        sendJson(res, httpStatus, {
          error: getLocalizedApiErrorMessage(category, 'en', 'chat'),
          category,
        }),
    },
    () => executeChatBody(req, res),
  );
}
