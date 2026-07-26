import { describe, expect, it } from "vitest";

import { createFixedWindowRateLimiter } from "../request-rate-limiter";

describe("AI request rate limiter", () => {
  it("allows a bounded number of requests and reports the retry window", () => {
    const limiter = createFixedWindowRateLimiter({
      maximumRequests: 2,
      windowMs: 60_000,
    });

    expect(limiter.check("client", 1_000)).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check("client", 2_000)).toEqual({ allowed: true, remaining: 0 });
    expect(limiter.check("client", 3_000)).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 58,
    });
  });

  it("resets expired clients and isolates separate keys", () => {
    const limiter = createFixedWindowRateLimiter({
      maximumRequests: 1,
      windowMs: 1_000,
    });

    expect(limiter.check("one", 0).allowed).toBe(true);
    expect(limiter.check("one", 100).allowed).toBe(false);
    expect(limiter.check("two", 100).allowed).toBe(true);
    expect(limiter.check("one", 1_000).allowed).toBe(true);
  });
});

