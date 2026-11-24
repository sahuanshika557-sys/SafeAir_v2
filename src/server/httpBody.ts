import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  HTTP_BAD_REQUEST,
  HTTP_PAYLOAD_TOO_LARGE,
  HTTP_UNSUPPORTED_MEDIA_TYPE,
  SERVER_MAX_BODY_BYTES,
} from '../constants/index.js';
import type { ApiErrorCategory } from '../types/index.js';

/** Minimal Node/Express/Vercel compatible request interface for API handlers. */
export interface ServerApiRequest extends IncomingMessage {
  query?: Record<string, unknown>;
  body?: unknown;
}

/** Minimal Node/Express/Vercel compatible response type for API handlers. */
export type ServerApiResponse = ServerResponse;

/** Maximum allowed POST JSON body size in bytes (`32 KB`). */
export const MAX_BODY_BYTES = SERVER_MAX_BODY_BYTES;

/** Error thrown when an incoming JSON POST body exceeds `MAX_BODY_BYTES`. */
export class PayloadTooLargeError extends Error {
  constructor() {
    super('Request payload exceeds limit.');
    this.name = 'PayloadTooLargeError';
  }
}

/** Error thrown when a JSON POST request specifies an unsupported `Content-Type`. */
export class UnsupportedMediaTypeError extends Error {
  constructor() {
    super('Content-Type must be application/json.');
    this.name = 'UnsupportedMediaTypeError';
  }
}

/**
 * Applies standard defense-in-depth HTTP response security headers.
 *
 * @param res - Outgoing server response.
 */
export function setSecurityHeaders(res: ServerApiResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
}

/**
 * Sends a JSON HTTP response with security headers and optional cache directives.
 */
export function sendJson(
  res: ServerApiResponse,
  statusCode: number,
  payload: unknown,
  cacheControl?: string,
): void {
  if (res.writableEnded) {
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  setSecurityHeaders(res);
  if (cacheControl) {
    res.setHeader('Cache-Control', cacheControl);
  }
  res.end(JSON.stringify(payload));
}

function checkPostContentType(req: ServerApiRequest): void {
  const rawType = req.headers?.['content-type'];
  if (!rawType) {
    return;
  }
  const primary = Array.isArray(rawType) ? (rawType[0] ?? '') : rawType;
  const normalized = primary.trim();
  if (!normalized) {
    return;
  }
  const mediaType = (normalized.split(';')[0] ?? '').trim().toLowerCase();
  if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
    throw new UnsupportedMediaTypeError();
  }
}

function parsePreparsedBody(body: unknown): unknown {
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf-8') > MAX_BODY_BYTES) {
      throw new PayloadTooLargeError();
    }
    return body.trim() ? JSON.parse(body) : {};
  }
  if (Buffer.isBuffer(body)) {
    if (body.length > MAX_BODY_BYTES) {
      throw new PayloadTooLargeError();
    }
    const text = body.toString('utf-8').trim();
    return text ? JSON.parse(text) : {};
  }
  const serialized = JSON.stringify(body);
  if (Buffer.byteLength(serialized, 'utf-8') > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError();
  }
  return body;
}

function readStreamJsonBody(req: ServerApiRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const fail = (err: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(err);
    };

    req.on('data', (chunk: Buffer | string) => {
      if (settled) {
        return;
      }
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : chunk;
      totalBytes += buf.length;
      if (totalBytes > MAX_BODY_BYTES) {
        fail(new PayloadTooLargeError());
        if (typeof req.destroy === 'function') {
          req.destroy();
        }
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => {
      if (settled) {
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf-8').trim();
        const parsed: unknown = raw ? JSON.parse(raw) : {};
        settled = true;
        resolve(parsed);
      } catch (parseErr) {
        fail(parseErr);
      }
    });

    req.on('error', fail);
  });
}

/**
 * Reads and parses a bounded (`<= 32 KB`) JSON request body across pre-parsed Express objects,
 * Vercel raw strings/Buffers, and Node readable streams.
 */
export async function readJsonBody(req: ServerApiRequest): Promise<unknown> {
  checkPostContentType(req);
  if (req.body !== undefined && req.body !== null) {
    return parsePreparsedBody(req.body);
  }
  if (req.readableEnded) {
    return {};
  }
  return readStreamJsonBody(req);
}

/**
 * Parses a JSON POST request body and writes standard HTTP error responses (`413`, `415`, or `400`)
 * when invalid.
 */
export async function parsePostJsonBody(
  req: ServerApiRequest,
  res: ServerApiResponse,
  invalidJsonMessage: string,
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    const data = await readJsonBody(req);
    return { ok: true, data };
  } catch (err: unknown) {
    if (err instanceof PayloadTooLargeError) {
      sendJson(res, HTTP_PAYLOAD_TOO_LARGE, {
        error: 'Request payload exceeds maximum size.',
        category: 'bad_request' satisfies ApiErrorCategory,
      });
      return { ok: false };
    }
    if (err instanceof UnsupportedMediaTypeError) {
      sendJson(res, HTTP_UNSUPPORTED_MEDIA_TYPE, {
        error: 'Content-Type must be application/json.',
        category: 'bad_request' satisfies ApiErrorCategory,
      });
      return { ok: false };
    }
    sendJson(res, HTTP_BAD_REQUEST, {
      error: invalidJsonMessage,
      category: 'bad_request' satisfies ApiErrorCategory,
    });
    return { ok: false };
  }
}
