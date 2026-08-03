/**
 * Simple sliding-window rate limiter (in-memory per isolate).
 * Good enough for edge foundation; replace with Redis/Upstash later if needed.
 */

interface Bucket {
  timestamps: number[];
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
const SWEEP_EVERY_CHECKS = 100;
let checkCount = 0;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;
  const bucket = buckets.get(key) ?? { timestamps: [], windowMs };
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);
  bucket.windowMs = windowMs;
  checkCount += 1;
  if (checkCount % SWEEP_EVERY_CHECKS === 0) {
    sweepExpiredBuckets(now);
  }
  if (bucket.timestamps.length === 0) {
    buckets.delete(key);
  }
  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    buckets.set(key, bucket);
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: oldest + windowMs,
    };
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    resetAt: now + windowMs,
  };
}

export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

function sweepExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    const windowStart = now - bucket.windowMs;
    bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}

/** Test helper */
export function _resetRateLimitBuckets(): void {
  buckets.clear();
  checkCount = 0;
}
