export type RatePolicy = { name: string; limit: number; windowSeconds: number };

// Generous for real use (a person tapping around) and tight enough to stop a
// script hammering the API or burning image-rendering and upload capacity.
export const RATE_POLICIES = {
  read: { name: "read", limit: 120, windowSeconds: 60 },
  write: { name: "write", limit: 60, windowSeconds: 60 },
  render: { name: "render", limit: 20, windowSeconds: 60 },
  upload: { name: "upload", limit: 10, windowSeconds: 60 },
  pushTest: { name: "push-test", limit: 5, windowSeconds: 300 },
} as const satisfies Record<string, RatePolicy>;

export function windowStartSeconds(nowMs: number, windowSeconds: number) {
  return Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
}

export type RateDecision = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/** Turns a request count in the current window into an allow or block decision. */
export function decideRate(count: number, policy: RatePolicy, nowMs: number): RateDecision {
  const windowEnd = windowStartSeconds(nowMs, policy.windowSeconds) + policy.windowSeconds;
  return {
    allowed: count <= policy.limit,
    remaining: Math.max(0, policy.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil(windowEnd - nowMs / 1000)),
  };
}

export const rateLimitKey = (policy: RatePolicy, userId: string) => `${policy.name}:${userId}`;
