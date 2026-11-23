import type { LifestyleProfile } from '../types/index.js';

/** Network timeout in milliseconds for external and AI requests. */
export const API_TIMEOUT_MS = 15000;

/** Reverse-geocoding HTTP timeout in milliseconds. */
export const REVERSE_GEOCODE_TIMEOUT_MS = 5000;

/** Geocoding search debounce delay in milliseconds. */
export const GEOCODING_DEBOUNCE_MS = 400;

/** Milliseconds in one second. */
export const MS_PER_SECOND = 1000;

/** Milliseconds in one minute. */
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;

/** Milliseconds in one hour. */
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** In-memory cache TTL for air quality readings (10 minutes). */
export const AQI_CACHE_TTL_MS = 10 * MS_PER_MINUTE;

/** In-memory cache TTL for generated plans (30 minutes). */
export const PLAN_CACHE_TTL_MS = 30 * MS_PER_MINUTE;

/** Server-side reverse geocoding cache TTL (1 hour). */
export const REVERSE_GEOCODE_CACHE_TTL_MS = MS_PER_HOUR;

/** Maximum allowed AI requests per client per sliding window. */
export const RATE_LIMIT_MAX_REQUESTS = 10;

/** Sliding rate limit window duration (1 minute). */
export const RATE_LIMIT_WINDOW_MS = MS_PER_MINUTE;

/** Maximum tracked client IP entries in server sliding-window map. */
export const SERVER_MAX_TRACKED_IPS = 500;

/** Server per-IP rate limit multiplier applied over client limit. */
export const SERVER_RATE_LIMIT_MULTIPLIER = 2;

/** Maximum request body payload size accepted by POST endpoints (32 KB). */
export const SERVER_MAX_BODY_BYTES = 32 * 1024;

/** Maximum entries held by server-side Open-Meteo TTL caches. */
export const SERVER_PROXY_CACHE_MAX_ENTRIES = 100;

/** Maximum entries held by client-side AQI and reverse-geocode caches. */
export const CLIENT_CACHE_MAX_ENTRIES = 50;

/** Maximum entries held by client-side plan cache. */
export const CLIENT_PLAN_CACHE_MAX_ENTRIES = 20;

/** Maximum length for user free-text notes and chat prompts. */
export const MAX_FREE_TEXT_LENGTH = 500;

/** Maximum length for city search queries. */
export const MAX_SEARCH_QUERY_LENGTH = 100;

/** Minimum query length before calling the geocoding API. */
export const MIN_SEARCH_QUERY_LENGTH = 2;

/** Maximum number of Open-Meteo geocoding search candidates requested. */
export const GEOCODING_SEARCH_COUNT = '6';

/** Geographic coordinate bounds in WGS84 decimal degrees. */
export const MIN_LATITUDE = -90;
export const MAX_LATITUDE = 90;
export const MIN_LONGITUDE = -180;
export const MAX_LONGITUDE = 180;

/** Maximum manual AQI input bound. */
export const MAX_US_AQI = 500;

/** Minimum manual AQI input bound. */
export const MIN_US_AQI = 0;

/** AQI threshold above which outdoor smog is considered severe in fallback plans. */
export const SEVERE_AQI_THRESHOLD = 150;

/** Maximum chat turns retained in prompt context. */
export const MAX_CHAT_HISTORY_MESSAGES = 8;

/** Maximum output tokens requested for structured JSON plan generation. */
export const PLAN_MAX_OUTPUT_TOKENS = 4096;

/** Maximum output tokens requested for conversational follow-up replies. */
export const CHAT_MAX_OUTPUT_TOKENS = 2400;

/** Non-Gemini-3/4 fallback sampling temperature. */
export const LEGACY_GEMINI_TEMPERATURE = 0.25;

/** Maximum characters included when repairing malformed plan JSON. */
export const PLAN_REPAIR_SNIPPET_LENGTH = 2000;

/** Maximum characters retained in diagnostic error messages. */
export const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 300;

/** Primary default Gemini model identifier (overridable via GEMINI_MODEL). */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** Ordered default Gemini model fallback chain evaluated on model-not-found, permission, or access errors. */
export const GEMINI_FALLBACK_MODELS: readonly string[] = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
];

/** Default secondary fallback Gemini model identifier when the primary model is unavailable. */
export const GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash';

/** Maximum live Gemini probe requests allowed per IP per rate-limit window on GET /api/health?probe=1. */
export const HEALTH_PROBE_RATE_LIMIT_MAX = 5;

/** Timeout in milliseconds for GET /api/health?probe=1 single-call verification. */
export const HEALTH_PROBE_TIMEOUT_MS = 10000;

/** Open-Meteo Geocoding API endpoint. */
export const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/** Open-Meteo Air Quality API endpoint. */
export const OPEN_METEO_AQI_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/** Free no-key reverse geocoding API endpoint called strictly server-side. */
export const REVERSE_GEOCODING_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/** Overall server-side Gemini timeout budget (within Vercel 60s maxDuration). */
export const SERVER_GEMINI_TOTAL_TIMEOUT_MS = 45000;

/** LocalStorage key for language preference only. */
export const LANGUAGE_STORAGE_KEY = 'safeair_saathi_language';

/** LocalStorage key for persistent animation pause preference. */
export const ANIMATIONS_PAUSED_STORAGE_KEY = 'safeair_saathi_animations_paused';

/** Maximum defensible combined PM2.5 exposure reduction cap (%). */
export const MAX_COMBINED_PM25_REDUCTION_PERCENT = 65;

/** Diminishing-returns factor applied to each additional overlapping exposure swap. */
export const IMPACT_DIMINISHING_FACTOR = 0.85;

/** Grams per kilogram conversion factor for CO2 display. */
export const GRAMS_PER_KILOGRAM = 1000;

/** Default Express HTTP server port when PORT environment variable is unset. */
export const DEFAULT_SERVER_PORT = 3000;

/** Initial exponential backoff delay in milliseconds for server Gemini retries. */
export const SERVER_RETRY_BASE_DELAY_MS = 250;

/** Maximum retry attempts per candidate Gemini model. */
export const MAX_MODEL_RETRY_ATTEMPTS = 3;

/** Maximum length for reverse-geocoded place labels returned to clients. */
export const MAX_PLACE_LABEL_LENGTH = 120;

/** Maximum length for sanitized IP address identifiers in rate-limit buckets. */
export const MAX_IP_LABEL_LENGTH = 80;

/** Minimum/maximum characters buffered for chat streaming scientific-claim checks. */
export const CHAT_STREAM_SAFE_BUFFER_CHARS = 180;
export const CHAT_STREAM_FORCE_FLUSH_CHARS = 260;

/** Maximum malformed plan text characters forwarded to the repair prompt. */
export const PLAN_REPAIR_CLIENT_SLICE_LENGTH = 2200;

/** Epsilon for floating-point coordinate equality checks (~111m). */
export const COORDINATE_MATCH_EPSILON = 0.001;

/** Standard HTTP status code constants used by server handlers. */
export const HTTP_OK = 200;
export const HTTP_NO_CONTENT = 204;
export const HTTP_BAD_REQUEST = 400;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;
export const HTTP_METHOD_NOT_ALLOWED = 405;
export const HTTP_PAYLOAD_TOO_LARGE = 413;
export const HTTP_UNSUPPORTED_MEDIA_TYPE = 415;
export const HTTP_TOO_MANY_REQUESTS = 429;
export const HTTP_INTERNAL_ERROR = 500;
export const HTTP_BAD_GATEWAY = 502;
export const HTTP_SERVICE_UNAVAILABLE = 503;
export const HTTP_GATEWAY_TIMEOUT = 504;

/** Request payload validation bounds shared by server Zod schemas. */
export const REPAIR_MALFORMED_MAX_CHARS = 2500;
export const LOCATION_FIELD_MAX_CHARS = 120;
export const LATITUDE_BOUND = 90;
export const LONGITUDE_BOUND = 180;
export const POLLUTANT_MAX_UG_M3 = 2000;
export const TIMESTAMP_MAX_CHARS = 80;
export const SOURCE_NAME_MAX_CHARS = 160;
export const CATEGORY_LABEL_MAX_CHARS = 80;
export const HEX_COLOR_MAX_CHARS = 20;
export const SUMMARY_TEXT_MAX_CHARS = 300;
export const CHAT_MESSAGE_CONTENT_MAX_CHARS = 2000;
export const LOCATION_CONTEXT_MAX_CHARS = 150;
export const CATEGORY_CONTEXT_MAX_CHARS = 100;
export const PLAN_SUMMARY_CONTEXT_MAX_CHARS = 600;
export const CHAT_HISTORY_ROLE_MULTIPLIER = 2;

/** Default initial location (New Delhi, India) for immediate first-load utility. */
export const DEFAULT_LOCATION = {
  id: 'default-new-delhi',
  name: 'New Delhi',
  admin1: 'Delhi',
  country: 'India',
  latitude: 28.6139,
  longitude: 77.209,
  source: 'search' as const,
};

/** Default lifestyle profile values. */
export const DEFAULT_PROFILE: LifestyleProfile = {
  household: ['children'],
  commuteMode: 'metro',
  workStyle: 'office',
  homeType: 'apartment',
  hasAirPurifier: false,
  cookingFuel: 'lpg',
  budget: 'medium',
  notes: '',
};
