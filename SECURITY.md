# Security Policy & Architecture

SafeAir Saathi processes sensitive user location lookups, household profiles, and AI requests with strict defense-in-depth controls.

## Supported Endpoints

All API routes run in Node.js (both in local Express via `server.ts` / `dist-server/server.js` and Vercel serverless functions in `/api/*`) sharing identical validation and security middleware via `src/server/apiHandlers.ts` and its cohesive submodules (`httpUtils.ts`, `schemas.ts`, `rateLimitStore.ts`, `openMeteoProxy.ts`, `geminiRunner.ts`).

## Core Security Controls

1. **Zero Client-Side Secret Exposure**
   - `GEMINI_API_KEY` is read strictly server-side from `process.env.GEMINI_API_KEY` in `src/server/geminiRunner.ts`.
   - It is never referenced with a `VITE_` prefix, never serialized into `dist/`, and never returned by `GET /api/health` (which returns only `keyConfigured: boolean`).
   - Log sanitization (`src/utils/errorDiagnostics.ts`) redacts API key patterns (`AIza...`), `Bearer` tokens, `apiKey=`/`key=` query params, `x-goog-api-key`, and `GEMINI_API_KEY` assignments before writing any diagnostic output.

2. **Strict Input & Schema Validation**
   - All `POST` routes enforce strict media-type parsing for `application/json` / `+json` (`415`) and a strict `32 KB` request body limit (`413`) with safe stream/string/Buffer/object `req.body` parsing.
   - All client inputs, AQI readings, coordinates (`latitude ∈ [-90, 90]`, `longitude ∈ [-180, 180]`), city search strings, household profiles, chat history, and Gemini JSON plans are validated at runtime with **Zod** (`src/utils/validation.ts`, `src/server/schemas.ts`).
   - Free-text inputs (lifestyle notes and follow-up questions) are capped at `500` characters (`MAX_FREE_TEXT_LENGTH`), stripped of `<`, `>`, ASCII control characters, and spoofed prompt delimiters.

3. **Prompt-Injection & Output Safety**
   - User-provided strings and location metadata are enclosed inside explicit `<<<USER_DATA_START>>>` and `<<<USER_DATA_END>>>` delimiters (`src/utils/promptBuilder.ts`) paired with data-only system instructions.
   - `@google/genai` safety settings block `BLOCK_MEDIUM_AND_ABOVE` across Harassment, Hate Speech, Sexually Explicit, and Dangerous Content.
   - AI chat responses render through a custom zero-HTML `SafeMarkdown` component (`src/components/SafeMarkdown.tsx`, `src/utils/safeMarkdown.ts`) supporting only bold, italic, ordered/unordered lists, and line breaks—React escapes all text nodes natively without `dangerouslySetInnerHTML` or external markdown libraries.
   - Server-side and client-side scientific accuracy sanitization (`src/utils/scientificFilter.ts`) strips unsupported houseplant PM2.5 purification, unrealistic filtration (`100%`/`99.9%+`), and cloth-mask PM2.5 claims across both `/api/plan` and `/api/chat`.

4. **HTTP Headers, CSP, and Origin Protections**
   - `vercel.json`, `server.ts`, `src/server/httpUtils.ts`, and `index.html` enforce:
     - `Content-Security-Policy` (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, restricted `connect-src`)
     - `X-Content-Type-Options: nosniff`
     - `X-Permitted-Cross-Domain-Policies: none`
     - `Referrer-Policy: no-referrer`
     - `X-Frame-Options: DENY`
     - `Cross-Origin-Opener-Policy: same-origin`

5. **Rate Limiting & Timeout Protection**
   - Sliding-window rate limiting (`src/utils/rateLimiter.ts`) caps client AI requests at `10/min` (`src/services/gemini.ts`) and per-IP server requests at `20/min` (`src/server/rateLimitStore.ts`) with bounded IP tracking (`MAX_TRACKED_IPS = 500`).
   - Upstream requests run under linked `AbortController` timeouts (`15s` for geo/AQI, `45s` server Gemini budget within `maxDuration: 60`).

6. **Privacy & Location Handling**
   - Browser geolocation executes only on explicit user click (`Use My Location`); coordinates exist solely in transient React state and are never logged, sent to analytics, or written to cookies/`localStorage`.
   - Only UI preferences—language (`'en'` | `'hi'` under `safeair_saathi_language`) and animation pause (`'true'` | `'false'` under `safeair_saathi_animations_paused`)—are stored in `localStorage`.

## Reporting a Vulnerability

If you discover a security issue, please avoid disclosing exploit details publicly on GitHub issues. Contact the maintainer privately or rotate affected API credentials immediately and audit logs for `invalid_key` or abnormal `quota_exceeded` classifications.
