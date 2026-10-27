import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";
import type { RatePolicy } from "@/lib/rate-limit-policy";
import { GET as getOrders } from "@/app/api/orders/route";
import { alice, signInAs } from "./helpers/session";

const tight: RatePolicy = { name: "test-tight", limit: 3, windowSeconds: 60 };

describe("rateLimit", () => {
  it("allows requests up to the limit, then answers 429 with Retry-After", async () => {
    for (let call = 1; call <= 3; call += 1) expect(await rateLimit("user-a", tight), `call ${call}`).toBeNull();

    const blocked = await rateLimit("user-a", tight);
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(await blocked?.json()).toEqual({ error: "You're doing that too fast. Wait a moment and try again." });
  });

  it("counts each user and each policy separately", async () => {
    const other: RatePolicy = { name: "test-other", limit: 1, windowSeconds: 60 };
    for (let call = 0; call < 4; call += 1) await rateLimit("user-b", tight);

    expect((await rateLimit("user-b", tight))?.status).toBe(429);
    expect(await rateLimit("user-c", tight)).toBeNull();
    expect(await rateLimit("user-b", other)).toBeNull();
    expect((await rateLimit("user-b", other))?.status).toBe(429);
  });

  it("protects real routes: a flood of reads from one person is cut off", async () => {
    await signInAs(alice);
    const statuses: number[] = [];
    for (let call = 0; call < 125; call += 1) statuses.push((await getOrders()).status);

    expect(statuses.slice(0, 120).every((status) => status === 200)).toBe(true);
    expect(statuses.slice(120)).toEqual([429, 429, 429, 429, 429]);
  });
});
