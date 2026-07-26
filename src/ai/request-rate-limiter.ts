export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; retryAfterSeconds: number };

export type FixedWindowRateLimiter = {
  check(key: string, now?: number): RateLimitDecision;
};

type Bucket = { count: number; resetsAt: number };

/**
 * A bounded, dependency-free burst guard for the public AI route. It is
 * deliberately best-effort in serverless runtimes: provider quota/rate errors
 * remain authoritative, while this guard prevents repeated requests handled by
 * the same worker isolate.
 */
export function createFixedWindowRateLimiter(options: {
  maximumRequests: number;
  windowMs: number;
  maximumKeys?: number;
}): FixedWindowRateLimiter {
  if (options.maximumRequests < 1 || options.windowMs < 1) {
    throw new Error("Rate-limit bounds must be positive.");
  }

  const maximumKeys = options.maximumKeys ?? 2_048;
  const buckets = new Map<string, Bucket>();

  return {
    check(rawKey, now = Date.now()) {
      const key = rawKey.trim().slice(0, 128) || "anonymous";
      let bucket = buckets.get(key);

      if (!bucket || bucket.resetsAt <= now) {
        bucket = { count: 0, resetsAt: now + options.windowMs };
        buckets.set(key, bucket);
      }

      if (bucket.count >= options.maximumRequests) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetsAt - now) / 1_000)),
        };
      }

      bucket.count += 1;

      if (buckets.size > maximumKeys) {
        for (const [candidateKey, candidate] of buckets) {
          if (candidate.resetsAt <= now) buckets.delete(candidateKey);
        }
        while (buckets.size > maximumKeys) {
          const oldestKey = buckets.keys().next().value as string | undefined;
          if (!oldestKey || oldestKey === key) break;
          buckets.delete(oldestKey);
        }
      }

      return {
        allowed: true,
        remaining: options.maximumRequests - bucket.count,
      };
    },
  };
}

