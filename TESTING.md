# Testing Guide — SafeAir Saathi

## Quick Commands

| Script                  | Description                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm test`              | Runs all 90 unit, service, server, integration, component, and `jest-axe` tests across 12 suites (`jsdom`).    |
| `npm run test:coverage` | Runs the full suite and outputs V8 coverage for `api`, `src/server`, `src/utils`, `src/services`, `src/hooks`. |
| `npm run lint`          | Runs ESLint (`typescript-eslint`, `react-hooks`, and `jsx-a11y`).                                              |
| `npm run lint:fix`      | Auto-fixes ESLint issues (`eslint . --fix`).                                                                   |
| `npm run typecheck`     | Runs strict TypeScript checking (`tsc --noEmit`).                                                              |
| `npm run format:check`  | Checks Prettier formatting across the repository.                                                              |
| `npm run check`         | Runs `format:check`, `lint`, `typecheck`, `test`, and `build` together.                                        |

## Test Structure

- `tests/unit/aqi.test.ts` — Verifies all US AQI category boundaries (`0`, `50`, `51`, `100`, `101`, `150`, `151`, `200`, `201`, `300`, `301`, `500`), negative/NaN clamping, manual reading generation, and timestamp formatting.
- `tests/unit/validation.test.ts` — Verifies HTML/delimiter sanitization, 500-char limits, city query validation, profile schema validation, chat message validation, and manual AQI bounds.
- `tests/unit/cacheAndRateLimiter.test.ts` — Verifies TTL expiration, LRU eviction, deterministic plan cache keys, and sliding-window rate limiting.
- `tests/unit/impactAndPrompt.test.ts` — Verifies multiplicative PM2.5 reduction math, CO₂ summation, prompt-injection delimiters (`<<<USER_DATA_START>>>` / `<<<USER_DATA_END>>>`), 100% EN/HI dictionary parity, and bilingual rule-based fallback plans.
- `tests/unit/markdownAndScience.test.ts` — Verifies `SafeMarkdown` AST parsing/normalization (Hindi & English, `** text:**`, unmatched `**`, underscore boundaries) and `scientificFilter.ts` claim guards + negation preservation.
- `tests/unit/errorDiagnostics.test.ts` — Verifies upstream error classification (`missing_key`, `invalid_key`, `quota_exceeded`, `model_unavailable`, `timeout`), secret redaction, and localized EN/HI error messages.
- `tests/unit/network.test.ts` — Verifies timeout wrappers, safe fetch retries, and abort propagation.
- `tests/unit/hooksAndStorage.test.ts` — Verifies `useDebounce`, `useGeolocation`, `useAirQuality`, `usePlanGenerator`, `useSpeechSynthesis`, and `localStorage` error-safe persistence.
- `tests/services/services.test.ts` — Mocks `fetch` for Open-Meteo, `/api/reverse-geocode`, and Gemini SSE/JSON endpoints (`/api/plan`, `/api/chat`), including `replacementText`, `MAX_TOKENS` truncation metadata, abrupt stream cutoffs, abort handling, and rate limits.
- `tests/server/apiHandlers.test.ts` — Tests all `/api/*` Vercel serverless handlers (`plan`, `chat`, `geocode`, `reverse-geocode`, `aqi`, `health?probe=1`), `GEMINI_MODEL` fallbacks, scientific filtering, and payload limits.
- `tests/components/components.test.tsx` — Exercises `App`, `Header`, `AqiHeroCard`, `HeroSkylineIllustration`, `BreathingLungsIllustration`, `CleanAirThoughtCard`, `ProfileForm`, `ActionPlanView`, `ImpactCalculator`, `FollowUpChat` (`Continue` flow), `SafeMarkdown`, and `ErrorBoundary` with `jest-axe` accessibility checks.
- `tests/integration/appFlows.test.tsx` — Runs full end-to-end `<App />` user flows (city search -> live AQI -> household profile -> streamed AI plan -> follow-up chat `Continue` -> light/dark `jest-axe` audits -> EN/HI toggle, plus `/api/plan` 503 fallback -> `Retry AI Plan` recovery).
