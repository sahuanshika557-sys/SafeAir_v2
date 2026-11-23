import {
  HTTP_METHOD_NOT_ALLOWED,
  HTTP_NO_CONTENT,
  MAX_IP_LABEL_LENGTH,
} from '../constants/index.js';
import type { ApiErrorCategory } from '../types/index.js';
import { sendJson, setSecurityHeaders, type ServerApiRequest, type ServerApiResponse } from './httpBody.js';

export {
  MAX_BODY_BYTES,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  parsePostJsonBody,
  readJsonBody,
  sendJson,
  setSecurityHeaders,
  type ServerApiRequest,
  type ServerApiResponse,
} from './httpBody.js';

/**
 * Extracts a single string query parameter from Express/Vercel `req.query` or `req.url`.
 */
export function getQueryParam(req: ServerApiRequest, key: string): string {
  if (req.query && key in req.query) {
    const val = req.query[key];
    if (typeof val === 'string') {
      return val;
    }
    if (Array.isArray(val) && typeof val[0] === 'string') {
      return val[0];
    }
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  return url.searchParams.get(key) ?? '';
}

/**
 * Extracts a bounded client IP string from proxy headers or socket metadata.
 */
export function getClientIp(req: ServerApiRequest): string {
  const forwarded = req.headers?.['x-forwarded-for'] ?? req.headers?.['x-vercel-forwarded-for'];
  const firstHeader = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof firstHeader === 'string' && firstHeader.trim()) {
    const primary = firstHeader.split(',')[0] ?? '';
    return primary.trim().slice(0, MAX_IP_LABEL_LENGTH);
  }
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim().slice(0, MAX_IP_LABEL_LENGTH);
  }
  const remoteAddr = req.socket?.remoteAddress;
  return typeof remoteAddr === 'string' && remoteAddr.trim()
    ? remoteAddr.slice(0, MAX_IP_LABEL_LENGTH)
    : 'local';
}

/**
 * Enforces allowed HTTP method (`GET` or `POST`) and responds cleanly to `OPTIONS` preflight checks.
 */
export function enforceHttpMethod(
  req: ServerApiRequest,
  res: ServerApiResponse,
  allowedMethod: 'GET' | 'POST',
): boolean {
  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.statusCode = HTTP_NO_CONTENT;
    res.setHeader('Allow', `${allowedMethod}, OPTIONS`);
    setSecurityHeaders(res);
    res.end();
    return false;
  }
  if (method !== allowedMethod) {
    res.setHeader('Allow', `${allowedMethod}, OPTIONS`);
    sendJson(res, HTTP_METHOD_NOT_ALLOWED, {
      error: `Method ${method} not allowed.`,
      category: 'bad_request' satisfies ApiErrorCategory,
    });
    return false;
  }
  return true;
}

/**
 * Writes a single JSON-serialized Server-Sent Events frame.
 */
export function writeSseEvent(res: ServerApiResponse, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}
