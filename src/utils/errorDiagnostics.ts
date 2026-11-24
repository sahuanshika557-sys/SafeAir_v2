import { MAX_DIAGNOSTIC_MESSAGE_LENGTH } from '../constants/index.js';
import type { ApiErrorCategory, Language } from '../types/index.js';

/** Structured non-secret diagnostic summary for server and service errors. */
export interface SafeErrorDiagnostics {
  errorType: string;
  status: string | number;
  message: string;
  category: ApiErrorCategory;
}

const SECRET_PATTERNS: readonly RegExp[] = [
  /AIza[\w-]{10,}/g,
  /Bearer\s+[\w.-]+/gi,
  /(?:apiKey|key)=[^&\s]+/gi,
  /(?:x-goog-api-key|GEMINI_API_KEY)\s*[:=]\s*\S+/gi,
];

function redactSecrets(message: string): string {
  let result = message;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

const HTTP_STATUS_TIMEOUT = 504;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_BAD_GATEWAY = 502;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HTTP_STATUS_BAD_REQUEST = 400;

const CATEGORY_HTTP_STATUS: Readonly<Record<ApiErrorCategory, number>> = {
  missing_key: HTTP_STATUS_SERVICE_UNAVAILABLE,
  invalid_key: HTTP_STATUS_BAD_GATEWAY,
  quota_exceeded: HTTP_STATUS_TOO_MANY_REQUESTS,
  model_unavailable: HTTP_STATUS_SERVICE_UNAVAILABLE,
  timeout: HTTP_STATUS_TIMEOUT,
  bad_request: HTTP_STATUS_BAD_REQUEST,
  upstream_error: HTTP_STATUS_BAD_GATEWAY,
};

const RETRYABLE_CATEGORIES: ReadonlySet<ApiErrorCategory> = new Set<ApiErrorCategory>([
  'quota_exceeded',
  'model_unavailable',
  'timeout',
  'upstream_error',
]);

const TIMEOUT_PHRASES = ['timeout', 'timed out', 'deadline_exceeded'] as const;
const INVALID_KEY_PHRASES = [
  'api_key_invalid',
  'api key not valid',
  'invalid api key',
  'api key expired',
  'unauthenticated',
  'unauthorized',
] as const;
const QUOTA_PHRASES = ['resource_exhausted', 'quota', 'rate limit'] as const;
const MODEL_UNAVAILABLE_PHRASES = [
  'not_found',
  'model_not_found',
  'not found',
  'unavailable',
  'overloaded',
] as const;
const MODEL_PERMISSION_HINTS = ['permission', 'access', 'allowed', 'enabled', 'supported'] as const;
const PERMISSION_DENIED_PHRASES = [
  'permission_denied',
  'permission',
  'access denied',
  'forbidden',
] as const;
const BAD_REQUEST_PHRASES = ['invalid_argument', 'bad request'] as const;

function matchesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function isTimeoutError(errorType: string, status: string | number, lowerMsg: string): boolean {
  return (
    errorType === 'AbortError' ||
    status === HTTP_STATUS_TIMEOUT ||
    status === 'ETIMEDOUT' ||
    matchesAny(lowerMsg, TIMEOUT_PHRASES)
  );
}

function isModelUnavailableError(status: string | number, lowerMsg: string): boolean {
  return (
    status === HTTP_STATUS_NOT_FOUND ||
    status === HTTP_STATUS_SERVICE_UNAVAILABLE ||
    matchesAny(lowerMsg, MODEL_UNAVAILABLE_PHRASES) ||
    (lowerMsg.includes('model') && matchesAny(lowerMsg, MODEL_PERMISSION_HINTS))
  );
}

function determineCategory(
  errorType: string,
  status: string | number,
  lowerMsg: string,
): ApiErrorCategory {
  if (isTimeoutError(errorType, status, lowerMsg)) {
    return 'timeout';
  }
  if (status === HTTP_STATUS_UNAUTHORIZED || matchesAny(lowerMsg, INVALID_KEY_PHRASES)) {
    return 'invalid_key';
  }
  if (status === HTTP_STATUS_TOO_MANY_REQUESTS || matchesAny(lowerMsg, QUOTA_PHRASES)) {
    return 'quota_exceeded';
  }
  if (isModelUnavailableError(status, lowerMsg)) {
    return 'model_unavailable';
  }
  if (status === HTTP_STATUS_FORBIDDEN || matchesAny(lowerMsg, PERMISSION_DENIED_PHRASES)) {
    return 'invalid_key';
  }
  if (status === HTTP_STATUS_BAD_REQUEST || matchesAny(lowerMsg, BAD_REQUEST_PHRASES)) {
    return 'bad_request';
  }
  return 'upstream_error';
}

/** Classifies an unknown upstream or network error into an {@link ApiErrorCategory}. */
export function classifyUpstreamError(err: unknown): {
  category: ApiErrorCategory;
  httpStatus: number;
  retryable: boolean;
} {
  const diag = extractSafeErrorDiagnostics(err);
  return {
    category: diag.category,
    httpStatus: CATEGORY_HTTP_STATUS[diag.category],
    retryable: RETRYABLE_CATEGORIES.has(diag.category),
  };
}

/** Returns `true` if the error indicates definitively rejected credentials across all models. */
export function isDefinitiveKeyFailure(err: unknown): boolean {
  const diag = extractSafeErrorDiagnostics(err);
  if (diag.category !== 'invalid_key') {
    return false;
  }
  return (
    diag.status === HTTP_STATUS_UNAUTHORIZED ||
    matchesAny(diag.message.toLowerCase(), INVALID_KEY_PHRASES)
  );
}

/** Extracts a redacted diagnostic summary never exposing API keys or bearer tokens. */
export function extractSafeErrorDiagnostics(err: unknown): SafeErrorDiagnostics {
  const record = typeof err === 'object' && err !== null ? err : undefined;
  const rawName = record && 'name' in record ? record.name : undefined;
  const errorType = typeof rawName === 'string' && rawName.trim() ? rawName : 'UnknownError';
  const rawStatus =
    record && 'status' in record && record.status !== undefined
      ? record.status
      : record && 'code' in record
        ? record.code
        : undefined;
  const status =
    typeof rawStatus === 'number' || typeof rawStatus === 'string' ? rawStatus : 'unknown';

  const rawMessage = err instanceof Error ? err.message : 'Unknown failure';
  const redacted = redactSecrets(rawMessage).slice(0, MAX_DIAGNOSTIC_MESSAGE_LENGTH);
  const category = determineCategory(errorType, status, redacted.toLowerCase());

  return { errorType, status, message: redacted, category };
}

const LOCALIZED_ERROR_MESSAGES: Readonly<
  Record<Language, Readonly<Record<ApiErrorCategory, string>>>
> = {
  hi: {
    missing_key: 'सर्वर पर एआई सेवा कॉन्फ़िगर नहीं है।',
    invalid_key: 'एआई सेवा की एपीआई कुंजी अमान्य है या अस्वीकृत कर दी गई है। कृपया सर्वर कुंजी कॉन्फ़िगरेशन जांचें।',
    quota_exceeded: 'एआई सेवा की उपयोग सीमा (कोटा) अभी समाप्त हो गई है। कृपया एक मिनट में पुनः प्रयास करें।',
    model_unavailable:
      'कॉन्फ़िगर किया गया एआई मॉडल अभी उपलब्ध या सुलभ नहीं है। कृपया कुछ क्षण बाद पुनः प्रयास करें।',
    timeout: 'एआई सेवा से उत्तर मिलने में बहुत समय लगा। कृपया पुनः प्रयास करें।',
    bad_request: 'अनुरोध डेटा अमान्य था। कृपया अपनी जानकारी जांचकर पुनः प्रयास करें।',
    upstream_error: 'एआई सेवा अभी अस्थायी रूप से उपलब्ध नहीं है। कृपया थोड़ी देर बाद पुनः प्रयास करें।',
  },
  en: {
    missing_key: 'The AI service is not configured on the server.',
    invalid_key:
      'The server AI API key is invalid or rejected. Please verify the API key configuration.',
    quota_exceeded: 'The AI quota or rate limit has been reached. Please retry in a minute.',
    model_unavailable:
      'The AI model is unavailable or not accessible for this key. Please retry shortly.',
    timeout: 'The AI service took too long to respond. Please retry.',
    bad_request: 'The request could not be processed. Please review your details and retry.',
    upstream_error: 'The AI service is temporarily unreachable. Please retry in a moment.',
  },
};

/** Maps an {@link ApiErrorCategory} to a localized user-facing message without exposing HTTP codes. */
export function getLocalizedApiErrorMessage(
  category: ApiErrorCategory,
  language: Language,
  context: 'plan' | 'chat',
): string {
  const base = LOCALIZED_ERROR_MESSAGES[language][category];
  if (context !== 'plan') {
    return base;
  }
  const suffix =
    language === 'hi'
      ? ' इसके बजाय नियम-आधारित सुरक्षा मार्गदर्शन दिखाया जा रहा है।'
      : ' Showing rule-based guidance instead.';
  return `${base}${suffix}`;
}
