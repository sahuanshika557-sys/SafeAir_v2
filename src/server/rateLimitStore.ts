import {
  HEALTH_PROBE_RATE_LIMIT_MAX,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  SERVER_MAX_TRACKED_IPS,
  SERVER_RATE_LIMIT_MULTIPLIER,
} from '../constants/index.js';
import { SlidingWindowRateLimiter } from '../utils/rateLimiter.js';
import { getClientIp, type ServerApiRequest } from './httpUtils.js';

const rateLimitersByIp = new Map<string, SlidingWindowRateLimiter>();
const probeRateLimitersByIp = new Map<string, SlidingWindowRateLimiter>();

function consumeRateLimitFromMap(
  map: Map<string, SlidingWindowRateLimiter>,
  req: ServerApiRequest,
  maxRequests: number,
) {
  const ip = getClientIp(req);
  let limiter = map.get(ip);
  if (!limiter) {
    if (map.size >= SERVER_MAX_TRACKED_IPS) {
      const oldestIp = map.keys().next().value;
      if (oldestIp !== undefined) {
        map.delete(oldestIp);
      }
    }
    limiter = new SlidingWindowRateLimiter(maxRequests, RATE_LIMIT_WINDOW_MS);
    map.set(ip, limiter);
  }
  return limiter.consume();
}

/**
 * Applies per-IP sliding-window rate limiting to AI generation endpoints.
 */
export function consumePerIpRateLimit(req: ServerApiRequest) {
  return consumeRateLimitFromMap(
    rateLimitersByIp,
    req,
    RATE_LIMIT_MAX_REQUESTS * SERVER_RATE_LIMIT_MULTIPLIER,
  );
}

/**
 * Applies stricter per-IP sliding-window rate limiting to live `?probe=1` health checks.
 */
export function consumeProbeRateLimit(req: ServerApiRequest) {
  return consumeRateLimitFromMap(probeRateLimitersByIp, req, HEALTH_PROBE_RATE_LIMIT_MAX);
}

/**
 * Resets all server-side per-IP sliding-window rate limiters (intended for tests).
 */
export function resetServerRateLimiter(): void {
  rateLimitersByIp.clear();
  probeRateLimitersByIp.clear();
}
