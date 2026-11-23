import { describe, expect, it } from 'vitest';
import type { ApiErrorCategory } from '../../src/types/index.js';
import {
  classifyUpstreamError,
  extractSafeErrorDiagnostics,
  getLocalizedApiErrorMessage,
  isDefinitiveKeyFailure,
} from '../../src/utils/errorDiagnostics.js';

describe('extractSafeErrorDiagnostics & error classification', () => {
  it('extracts errorType, numeric status, and message safely', () => {
    const err = Object.assign(new Error('Model gemini-3.8-flash returned HTTP 404'), {
      name: 'ApiError',
      status: 404,
    });
    const diag = extractSafeErrorDiagnostics(err);
    expect(diag.errorType).toBe('ApiError');
    expect(diag.status).toBe(404);
    expect(diag.category).toBe('model_unavailable');
    expect(diag.message).toContain('HTTP 404');
  });

  it('redacts API keys, Bearer tokens, x-goog-api-key, GEMINI_API_KEY, and query key parameters', () => {
    const err = new Error(
      'Request failed with AIzaSyDummySecretKey1234567890 and Bearer eyJhbGciOiJIUzI1NiJ9.payload and ?apiKey=secret_val_99 and ?key=secret_q_11 and x-goog-api-key: secret_hdr_22 and GEMINI_API_KEY=secret_env_33',
    );
    const diag = extractSafeErrorDiagnostics(err);
    expect(diag.message).not.toContain('AIzaSyDummySecretKey');
    expect(diag.message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(diag.message).not.toContain('secret_val_99');
    expect(diag.message).not.toContain('secret_q_11');
    expect(diag.message).not.toContain('secret_hdr_22');
    expect(diag.message).not.toContain('secret_env_33');
    expect(diag.message).toContain('[REDACTED]');
  });

  it('handles non-Error objects and truncates overly long messages', () => {
    const longErr = new Error('x'.repeat(500));
    expect(extractSafeErrorDiagnostics(longErr).message).toHaveLength(300);

    const unknownDiag = extractSafeErrorDiagnostics({ code: 'ECONNRESET' });
    expect(unknownDiag.errorType).toBe('UnknownError');
    expect(unknownDiag.status).toBe('ECONNRESET');
    expect(unknownDiag.message).toBe('Unknown failure');
    expect(unknownDiag.category).toBe('upstream_error');
  });

  it('classifies upstream errors into stable categories, HTTP codes, and retryable flags', () => {
    const apiKeyErr = Object.assign(new Error('API_KEY_INVALID'), { status: 403 });
    expect(classifyUpstreamError(apiKeyErr)).toEqual({
      category: 'invalid_key',
      httpStatus: 502,
      retryable: false,
    });
    expect(isDefinitiveKeyFailure(apiKeyErr)).toBe(true);

    const modelAccessErr = Object.assign(
      new Error('PERMISSION_DENIED: Caller does not have access to model gemini-3.8-flash'),
      { status: 403 },
    );
    expect(classifyUpstreamError(modelAccessErr)).toEqual({
      category: 'model_unavailable',
      httpStatus: 503,
      retryable: true,
    });
    expect(isDefinitiveKeyFailure(modelAccessErr)).toBe(false);

    const genericPermErr = Object.assign(new Error('PERMISSION_DENIED'), { status: 403 });
    expect(classifyUpstreamError(genericPermErr).category).toBe('invalid_key');
    expect(isDefinitiveKeyFailure(genericPermErr)).toBe(false);

    expect(
      classifyUpstreamError(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 })),
    ).toEqual({
      category: 'quota_exceeded',
      httpStatus: 429,
      retryable: true,
    });

    expect(
      classifyUpstreamError(Object.assign(new Error('Model not found'), { status: 404 })),
    ).toEqual({
      category: 'model_unavailable',
      httpStatus: 503,
      retryable: true,
    });

    expect(classifyUpstreamError(new DOMException('Timed out', 'AbortError'))).toEqual({
      category: 'timeout',
      httpStatus: 504,
      retryable: true,
    });

    expect(
      classifyUpstreamError(Object.assign(new Error('INVALID_ARGUMENT'), { status: 400 })),
    ).toEqual({
      category: 'bad_request',
      httpStatus: 400,
      retryable: false,
    });

    expect(classifyUpstreamError(new Error('Socket hang up'))).toEqual({
      category: 'upstream_error',
      httpStatus: 502,
      retryable: true,
    });
  });

  it('produces friendly, distinct EN and HI messages for invalid_key, quota_exceeded, and model_unavailable without raw HTTP codes', () => {
    const categories: ApiErrorCategory[] = [
      'missing_key',
      'invalid_key',
      'quota_exceeded',
      'model_unavailable',
      'timeout',
      'bad_request',
      'upstream_error',
    ];

    for (const category of categories) {
      const enPlan = getLocalizedApiErrorMessage(category, 'en', 'plan');
      const hiPlan = getLocalizedApiErrorMessage(category, 'hi', 'plan');
      const enChat = getLocalizedApiErrorMessage(category, 'en', 'chat');
      const hiChat = getLocalizedApiErrorMessage(category, 'hi', 'chat');

      expect(enPlan).toContain('rule-based guidance');
      expect(hiPlan).toContain('नियम-आधारित');
      expect(enChat).not.toContain('rule-based');
      expect(hiChat).toMatch(/[\u0900-\u097F]/);

      for (const msg of [enPlan, hiPlan, enChat, hiChat]) {
        expect(msg).not.toMatch(/\bHTTP\s*\d{3}\b/i);
        expect(msg).not.toContain('500');
      }
    }

    const keyEn = getLocalizedApiErrorMessage('invalid_key', 'en', 'chat');
    const quotaEn = getLocalizedApiErrorMessage('quota_exceeded', 'en', 'chat');
    const modelEn = getLocalizedApiErrorMessage('model_unavailable', 'en', 'chat');
    expect(new Set([keyEn, quotaEn, modelEn]).size).toBe(3);
    expect(keyEn.toLowerCase()).toContain('key');
    expect(quotaEn.toLowerCase()).toContain('quota');
    expect(modelEn.toLowerCase()).toContain('model');

    const keyHi = getLocalizedApiErrorMessage('invalid_key', 'hi', 'chat');
    const quotaHi = getLocalizedApiErrorMessage('quota_exceeded', 'hi', 'chat');
    const modelHi = getLocalizedApiErrorMessage('model_unavailable', 'hi', 'chat');
    expect(new Set([keyHi, quotaHi, modelHi]).size).toBe(3);
    expect(keyHi).toContain('कुंजी');
    expect(quotaHi).toContain('कोटा');
    expect(modelHi).toContain('मॉडल');
  });
});
