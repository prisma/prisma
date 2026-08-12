export interface RateLimiter {
  allow(key: string): boolean;
}

export interface TokenBucketOptions {
  /** Maximum tokens the bucket holds (== max burst size). */
  readonly capacity: number;
  /** Tokens added per millisecond; capped at capacity. */
  readonly refillTokensPerMs: number;
  /** Time source; defaults to `Date.now`. Injected for deterministic tests. */
  readonly now?: () => number;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

/**
 * In-process token-bucket rate limiter keyed by an arbitrary string (in
 * production: client IP). Allocates one bucket per first-seen key; buckets are
 * retained for the process lifetime. EA-stage traffic is small enough that the
 * map's memory footprint is bounded by the population of legitimate clients.
 */
class TokenBucketRateLimiter implements RateLimiter {
  readonly #capacity: number;
  readonly #refillTokensPerMs: number;
  readonly #now: () => number;
  readonly #buckets = new Map<string, Bucket>();

  constructor(options: TokenBucketOptions) {
    if (!Number.isFinite(options.capacity) || options.capacity <= 0) {
      throw new Error(
        `TokenBucketRateLimiter: capacity must be a finite number > 0 (got ${options.capacity})`,
      );
    }
    if (!Number.isFinite(options.refillTokensPerMs) || options.refillTokensPerMs < 0) {
      throw new Error(
        `TokenBucketRateLimiter: refillTokensPerMs must be a finite number >= 0 (got ${options.refillTokensPerMs})`,
      );
    }
    this.#capacity = options.capacity;
    this.#refillTokensPerMs = options.refillTokensPerMs;
    this.#now = options.now ?? Date.now;
  }

  allow(key: string): boolean {
    const nowMs = this.#now();
    const existing = this.#buckets.get(key);
    if (existing === undefined) {
      this.#buckets.set(key, { tokens: this.#capacity - 1, lastRefillMs: nowMs });
      return true;
    }
    const elapsedMs = Math.max(0, nowMs - existing.lastRefillMs);
    existing.tokens = Math.min(
      this.#capacity,
      existing.tokens + elapsedMs * this.#refillTokensPerMs,
    );
    existing.lastRefillMs = nowMs;
    if (existing.tokens >= 1) {
      existing.tokens -= 1;
      return true;
    }
    return false;
  }
}

export function createTokenBucketRateLimiter(options: TokenBucketOptions): RateLimiter {
  return new TokenBucketRateLimiter(options);
}

/**
 * Convenience factory that converts a "requests per minute per key" threshold
 * into the underlying token-bucket parameters. The bucket starts full so the
 * first N requests inside the same second go through (legitimate clients
 * behind a NAT often burst at startup); the refill rate is uniform across
 * the minute.
 */
export function createRequestsPerMinuteRateLimiter(rpm: number, now?: () => number): RateLimiter {
  if (!Number.isFinite(rpm) || rpm <= 0) {
    throw new Error(
      `createRequestsPerMinuteRateLimiter: rpm must be a finite number > 0 (got ${rpm})`,
    );
  }
  return createTokenBucketRateLimiter({
    capacity: rpm,
    refillTokensPerMs: rpm / 60_000,
    ...(now ? { now } : {}),
  });
}
