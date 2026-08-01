/**
 * Simple sliding-window rate limiter (in-memory per isolate).
 * Good enough for edge foundation; replace with Redis/Upstash later if needed.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

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
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);
  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: oldest + windowMs,
    };
  }
  bucket.timestamps.push(now);
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    resetAt: now + windowMs,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

/** Test helper */
export function _resetRateLimitBuckets(): void {
  buckets.clear();
}
