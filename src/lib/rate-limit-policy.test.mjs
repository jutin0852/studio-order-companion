import assert from "node:assert/strict";
import test from "node:test";
import { decideRate, RATE_POLICIES, rateLimitKey, windowStartSeconds } from "./rate-limit-policy.ts";

const policy = { name: "t", limit: 3, windowSeconds: 60 };

test("windows are fixed and aligned to the window size", () => {
  assert.equal(windowStartSeconds(60_000, 60), 60);
  assert.equal(windowStartSeconds(119_999, 60), 60);
  assert.equal(windowStartSeconds(120_000, 60), 120);
});

test("requests up to the limit are allowed and the next one is blocked", () => {
  const now = 61_000;
  assert.equal(decideRate(1, policy, now).allowed, true);
  assert.equal(decideRate(3, policy, now).allowed, true);
  assert.equal(decideRate(3, policy, now).remaining, 0);
  assert.equal(decideRate(4, policy, now).allowed, false);
});

test("a blocked caller is told when the window ends", () => {
  assert.equal(decideRate(4, policy, 61_000).retryAfterSeconds, 59);
  assert.equal(decideRate(4, policy, 119_500).retryAfterSeconds, 1);
});

test("keys are scoped by policy and user", () => {
  assert.equal(rateLimitKey(policy, "u1"), "t:u1");
  assert.notEqual(rateLimitKey(RATE_POLICIES.read, "u1"), rateLimitKey(RATE_POLICIES.write, "u1"));
});

test("sensitive policies are tighter than ordinary ones", () => {
  assert.ok(RATE_POLICIES.upload.limit < RATE_POLICIES.write.limit);
  assert.ok(RATE_POLICIES.write.limit < RATE_POLICIES.read.limit);
  assert.ok(RATE_POLICIES.pushTest.limit <= 5);
});
