import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decideRate, rateLimitKey, windowStartSeconds, type RatePolicy } from "@/lib/rate-limit-policy";

// Old windows are useless, so sweep them now and then instead of on every call.
const CLEANUP_CHANCE = 0.01;

/**
 * Counts this request against the user's allowance for a policy. Returns a 429
 * response when they are over it, otherwise null. Fails open: if the database
 * cannot be reached, requests go through rather than locking everyone out.
 */
export async function rateLimit(userId: string, policy: RatePolicy): Promise<NextResponse | null> {
  if (!db) return null;
  const now = Date.now();
  try {
    const windowStart = windowStartSeconds(now, policy.windowSeconds);
    const result = await db.query<{ count: number }>(
      `INSERT INTO api_rate_limits (key, window_start, count) VALUES ($1, $2, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = api_rate_limits.count + 1
       RETURNING count`,
      [rateLimitKey(policy, userId), windowStart],
    );
    if (Math.random() < CLEANUP_CHANCE) {
      void db.query("DELETE FROM api_rate_limits WHERE window_start < $1", [Math.floor(now / 1000) - 3_600]).catch(() => undefined);
    }
    const decision = decideRate(Number(result.rows[0].count), policy, now);
    if (decision.allowed) return null;
    return NextResponse.json(
      { error: "You're doing that too fast. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
    );
  } catch (error) {
    console.error("[rate-limit] check failed, allowing the request", { policy: policy.name, code: (error as { code?: string }).code });
    return null;
  }
}
