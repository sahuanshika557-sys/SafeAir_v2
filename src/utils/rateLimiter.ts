import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '../constants/index.js';
import type { RateLimitResult } from '../types/index.js';

/**
 * Sliding-window rate limiter to protect AI endpoints from accidental bursts.
 */
export class SlidingWindowRateLimiter {
  private readonly timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(
    maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
    windowMs: number = RATE_LIMIT_WINDOW_MS,
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Checks whether a request is permitted at the given timestamp and records it if allowed.
   *
   * @param now - Optional epoch timestamp in milliseconds.
   * @returns {@link RateLimitResult} indicating allowance, remaining quota, and retry delay.
   */
  public consume(now: number = Date.now()): RateLimitResult {
    this.pruneExpired(now);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0] ?? now;
      const retryAfterMs = Math.max(0, oldest + this.windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
      };
    }

    this.timestamps.push(now);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - this.timestamps.length),
      retryAfterMs: 0,
    };
  }

  /**
   * Returns remaining quota without consuming a request slot.
   *
   * @param now - Optional epoch timestamp in milliseconds.
   * @returns Number of requests remaining in the active window.
   */
  public peekRemaining(now: number = Date.now()): number {
    this.pruneExpired(now);
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }

  /**
   * Resets all recorded request timestamps.
   */
  public reset(): void {
    this.timestamps.length = 0;
  }

  private pruneExpired(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.timestamps[0] !== undefined && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }
  }
}
