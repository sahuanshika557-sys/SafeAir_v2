import { z } from 'zod';
import {
  DEFAULT_SERVER_PORT,
  GEMINI_FALLBACK_MODELS,
  GEMINI_MODEL,
} from '../constants/index.js';

const MAX_PORT_NUMBER = 65535;
const PLACEHOLDER_GEMINI_KEY = 'MY_GEMINI_API_KEY';

const optionalTrimmedString = z
  .string()
  .optional()
  .transform((val) => {
    const trimmed = val?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  });

const serverEnvSchema = z.object({
  GEMINI_API_KEY: optionalTrimmedString,
  GEMINI_MODEL: optionalTrimmedString,
  GEMINI_FALLBACK_MODEL: optionalTrimmedString,
  APP_URL: optionalTrimmedString.refine(
    (val) => {
      if (!val) {
        return true;
      }
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'APP_URL must be a valid http or https URL.' },
  ),
  PORT: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      const trimmed = raw?.trim();
      if (!trimmed) {
        return DEFAULT_SERVER_PORT;
      }
      const parsed = Number(trimmed);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PORT_NUMBER) {
        ctx.addIssue({
          code: 'custom',
          message: `PORT must be an integer between 1 and ${MAX_PORT_NUMBER}.`,
        });
        return z.NEVER;
      }
      return parsed;
    }),
  NODE_ENV: optionalTrimmedString,
});

/** Validated server-side runtime environment configuration. */
export type ValidatedServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parses and validates server environment variables via Zod, throwing a concise
 * descriptive error immediately when explicit configuration values are invalid.
 *
 * @param env - Raw process environment dictionary (defaults to `process.env`).
 * @returns Validated server environment configuration.
 */
export function readServerEnv(
  env: Record<string, string | undefined> = process.env,
): ValidatedServerEnv {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.message).join(' ');
    throw new Error(`Invalid server environment configuration: ${details}`);
  }
  return result.data;
}

/**
 * Returns the validated HTTP server port (`PORT` or `3000`).
 */
export function getServerPort(): number {
  return readServerEnv().PORT;
}

/**
 * Returns the configured Gemini API key when present and non-placeholder, or `null`.
 */
export function getConfiguredGeminiApiKey(): string | null {
  const { GEMINI_API_KEY } = readServerEnv();
  if (!GEMINI_API_KEY || GEMINI_API_KEY === PLACEHOLDER_GEMINI_KEY) {
    return null;
  }
  return GEMINI_API_KEY;
}

/**
 * Returns whether a real (non-placeholder) `GEMINI_API_KEY` is configured on the server.
 */
export function hasConfiguredGeminiKey(): boolean {
  return getConfiguredGeminiApiKey() !== null;
}

/**
 * Returns the primary configured Gemini model name (`GEMINI_MODEL` or `gemini-3.5-flash-lite`).
 */
export function getPrimaryGeminiModel(): string {
  return readServerEnv().GEMINI_MODEL ?? GEMINI_MODEL;
}

/**
 * Returns ordered unique Gemini model candidates evaluated during fallback retries.
 */
export function getGeminiModelCandidates(): string[] {
  const { GEMINI_MODEL: primary, GEMINI_FALLBACK_MODEL: extraFallback } = readServerEnv();
  return Array.from(
    new Set(
      [primary, extraFallback, ...GEMINI_FALLBACK_MODELS].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ),
    ),
  );
}
