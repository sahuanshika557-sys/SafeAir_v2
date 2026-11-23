import { HTTP_TOO_MANY_REQUESTS } from '../constants/index.js';
import type { ApiErrorCategory } from '../types/index.js';
import { classifyUpstreamError, getLocalizedApiErrorMessage } from '../utils/errorDiagnostics.js';
import {
  enforceHttpMethod,
  parsePostJsonBody,
  sendJson,
  type ServerApiRequest,
  type ServerApiResponse,
} from './httpUtils.js';
import { consumePerIpRateLimit } from './rateLimitStore.js';

/**
 * Shared guard for API handlers enforcing HTTP method and translating unexpected thrown errors
 * into safe category-based JSON responses without duplicating `try/catch` boilerplate.
 */
export async function runApiRoute(
  req: ServerApiRequest,
  res: ServerApiResponse,
  options: {
    allowedMethod: 'GET' | 'POST';
    routeLabel: string;
    onError: (category: ApiErrorCategory, httpStatus: number) => void;
  },
  handler: () => Promise<void>,
): Promise<void> {
  try {
    if (!enforceHttpMethod(req, res, options.allowedMethod)) {
      return;
    }
    await handler();
  } catch (err: unknown) {
    const { category, httpStatus } = classifyUpstreamError(err);
    console.error(`[SafeAir Saathi] ${options.routeLabel} unhandled:`, {
      category,
      status: httpStatus,
    });
    options.onError(category, httpStatus);
  }
}

/**
 * Enforces per-IP rate limiting and parses a bounded JSON POST body for AI routes (`/api/plan`, `/api/chat`).
 */
export async function parseRateLimitedPostBody(
  req: ServerApiRequest,
  res: ServerApiResponse,
  options: { contextType: 'plan' | 'chat'; invalidJsonMessage: string },
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  const rate = consumePerIpRateLimit(req);
  if (!rate.allowed) {
    sendJson(res, HTTP_TOO_MANY_REQUESTS, {
      error: getLocalizedApiErrorMessage('quota_exceeded', 'en', options.contextType),
      category: 'quota_exceeded' satisfies ApiErrorCategory,
    });
    return { ok: false };
  }
  return parsePostJsonBody(req, res, options.invalidJsonMessage);
}

/**
 * Determines whether the caller requested a non-streaming JSON response instead of SSE.
 */
export function shouldPreferNonStreaming(
  req: ServerApiRequest,
  streamFlag: boolean | undefined,
  forceNonStreaming = false,
): boolean {
  const acceptHeader = req.headers?.['accept'];
  return (
    streamFlag === false ||
    forceNonStreaming ||
    (typeof acceptHeader === 'string' && acceptHeader.includes('application/json'))
  );
}
