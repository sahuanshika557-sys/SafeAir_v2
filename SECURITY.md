# Security Policy & Architecture

SafeAir Saathi processes sensitive user location lookups, household profiles, and AI requests with strict defense-in-depth controls.

## Supported Endpoints

All API routes run in Node.js (both local Express via `server.ts` / `dist-server/server.js` and Vercel serverless functions in `/api/*`) sharing identical validation and security middleware via `src/server/apiHandlers.ts` and its cohesive submodules (`aiRouteHandlers.ts`, `env.ts`, `geminiClient.ts`, `geminiRunner.ts`, `geminiSseEmitter.ts`, `geminiStream.ts`, `geoAqiHandlers.ts`, `healthHandler.ts`, `httpBody.ts`, `httpUtils.ts`, `openMeteoProxy.ts`, `rateLimitStore.ts`, `routeHelpers.ts`, `schemas.ts`).

## Threat Model

| Entry Point / Asset                                | Threat                                                             | Trust Boundary                                                | Mitigations & Verification                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                                   | Client bundle leakage or disclosure in `/api/*` errors/logs        | Server `process.env` -> API handlers                          | Read & Zod-validated exclusively in `src/server/env.ts`; never prefixed with `VITE_`; placeholders rejected; secrets stripped by `src/utils/errorDiagnostics.ts`; verified in CI via `grep` scan on `dist/` and in `tests/server/apiHandlers.test.ts`                             |
| `POST /api/plan`, `POST /api/chat`                 | Oversized payloads, wrong MIME types, prototype/schema injection   | Untrusted HTTP client -> `httpBody.ts` / `schemas.ts`         | Strict `application/json` / `+json` check (`415`), `32 KB` cap (`413`), Zod runtime schemas (`max 500` chars notes/questions, bounded chat history), invalid-control-char stripping                                                                                               |
| Prompt inputs (`notes`, `message`, location names) | Prompt injection & delimiter spoofing                              | User profile / chat -> `promptBuilder.ts`                     | Strips `<`, `>`, ASCII control chars, and delimiter strings; wraps all user fields inside `<<<USER_DATA_START>>>` ... `<<<USER_DATA_END>>>` data blocks                                                                                                                           |
| AI model responses                                 | XSS via HTML/script injection or medical/scientific misinformation | External Gemini API -> React UI                               | Custom zero-HTML AST renderer `SafeMarkdown` (`src/components/SafeMarkdown.tsx`, zero `dangerouslySetInnerHTML`); `@google/genai` `BLOCK_MEDIUM_AND_ABOVE`; `scientificFilter.ts` strips houseplant/cloth-mask/`100%` myths                                                       |
| Public API & upstream endpoints                    | Burst abuse, DoS, slowloris/hung sockets                           | Browser / public caller -> `rateLimitStore.ts` / `network.ts` | `10 req/min` client + `20 req/min` per-IP server sliding-window rate limits (`MAX_TRACKED_IPS = 500`), `5/min` per-IP cap on `/api/health?probe=1`, `AbortController` timeouts (`15s` geo/AQI, `45s` server Gemini)                                                               |
| Browser SPA runtime                                | Clickjacking, MIME sniffing, referrer leakage, insecure downgrade  | Browser -> HTTP headers / `vercel.json`                       | Production `Content-Security-Policy` (`style-src 'self'`, `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` |
| Supply chain & VCS                                 | Vulnerable packages or accidental key commits                      | `package.json` / `bun.lock` / PRs                             | Automated `.github/dependabot.yml` weekly updates plus `.github/workflows/ci.yml` (`bun audit --audit-level=high` and `gitleaks/gitleaks-action`)                                                                                                                                 |

## Core Security Controls

1. **Zero Client-Side Secret Exposure & Fail-Fast Env Validation**
   - Server configuration (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `APP_URL`, `PORT`) is parsed and validated with Zod in `src/server/env.ts`, rejecting malformed `PORT` (`1..65535`) or non-`http(s)` `APP_URL` values immediately and treating `.env.example` placeholder `MY_GEMINI_API_KEY` as unconfigured.
   - `GEMINI_API_KEY` is never referenced with a `VITE_` prefix, never serialized into `dist/`, and never returned by `GET /api/health` (which returns only `keyConfigured: boolean`).
   - Log sanitization (`src/utils/errorDiagnostics.ts`) redacts API key patterns (`AIza...`), `Bearer` tokens, `apiKey=`/`key=` query params, `x-goog-api-key`, and `GEMINI_API_KEY` assignments before writing any diagnostic output.

2. **Strict Input & Schema Validation**
   - All `POST` routes enforce strict media-type parsing for `application/json` / `+json` (`415`) and a strict `32 KB` request body limit (`413`) with safe stream/string/Buffer/object `req.body` parsing (`src/server/httpBody.ts`).
   - All client inputs, AQI readings, coordinates (`latitude ∈ [-90, 90]`, `longitude ∈ [-180, 180]`), city search strings, household profiles, chat history, and Gemini JSON plans are validated at runtime with **Zod** (`src/utils/validation.ts`, `src/server/schemas.ts`).

3. **Prompt-Injection & Output Safety**
   - User data is fenced inside `<<<USER_DATA_START>>>` and `<<<USER_DATA_END>>>` (`src/utils/promptBuilder.ts`) paired with strict data-only system instructions.
   - AI chat responses render through `SafeMarkdown` (`src/components/SafeMarkdown.tsx`, `src/utils/safeMarkdown.ts`) without `dangerouslySetInnerHTML`.
   - Scientific claim sanitization (`src/utils/scientificFilter.ts`) scrubs inaccurate houseplant, `100%` filtration, and cloth-mask PM2.5 claims in both English and Hindi.

4. **HTTP Headers & CSP Architecture**
   - `vercel.json` and production `server.ts` enforce `Content-Security-Policy` (`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`), `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `X-Permitted-Cross-Domain-Policies: none`, `Referrer-Policy: no-referrer`, and `X-Frame-Options: DENY`.
   - `index.html` retains `style-src 'self' 'unsafe-inline'` in its meta tag solely to support Vite dev-mode CSS injection on `localhost:3000`, while production deployments have zero inline `<style>` tags or `style=` attributes and enforce `style-src 'self'` via HTTP headers.

5. **Privacy & Location Handling**
   - Browser geolocation runs only on explicit user click (`Use My Location`); coordinates exist solely in transient React state and are never logged, sent to analytics, or written to cookies/`localStorage`.
   - Only UI preferences—language (`'en'` | `'hi'` under `safeair_saathi_language`) and animation pause (`'true'` | `'false'` under `safeair_saathi_animations_paused`)—are stored in `localStorage`.

## Reporting a Vulnerability

If you discover a security issue, please avoid disclosing exploit details publicly on GitHub issues. Contact the maintainer privately or rotate affected API credentials immediately and audit logs for `invalid_key` or abnormal `quota_exceeded` classifications.
