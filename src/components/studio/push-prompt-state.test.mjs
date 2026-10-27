import assert from "node:assert/strict";
import test from "node:test";
import { dismissedUntilFrom, pushPromptState, PUSH_PROMPT_DISMISS_DAYS } from "./push-prompt-state.ts";

const now = Date.UTC(2026, 9, 28);
const base = { supported: true, permission: "default", subscribed: false, dismissedUntil: null, now, isIos: false, standalone: false };

test("asks when push works here and has not been turned on", () => {
  assert.equal(pushPromptState(base), "enable");
});

test("stays quiet once notifications are on", () => {
  assert.equal(pushPromptState({ ...base, subscribed: true, permission: "granted" }), "hidden");
});

test("asks again to finish when permission was granted but this device lost its subscription", () => {
  assert.equal(pushPromptState({ ...base, permission: "granted", subscribed: false }), "enable");
});

test("does not nag when the browser has blocked notifications", () => {
  assert.equal(pushPromptState({ ...base, permission: "denied" }), "hidden");
});

test("respects Not now for a week, then asks again", () => {
  const dismissedUntil = dismissedUntilFrom(now);
  assert.equal(dismissedUntil - now, PUSH_PROMPT_DISMISS_DAYS * 86_400_000);
  assert.equal(pushPromptState({ ...base, dismissedUntil }), "hidden");
  assert.equal(pushPromptState({ ...base, dismissedUntil, now: dismissedUntil + 1 }), "enable");
});

test("explains Home Screen install on an iPhone browser tab, and nothing on other unsupported browsers", () => {
  assert.equal(pushPromptState({ ...base, supported: false, isIos: true, standalone: false }), "ios-install");
  assert.equal(pushPromptState({ ...base, supported: false, isIos: true, standalone: true }), "hidden");
  assert.equal(pushPromptState({ ...base, supported: false, isIos: false }), "hidden");
});

test("a dismissed iPhone tip stays dismissed", () => {
  assert.equal(pushPromptState({ ...base, supported: false, isIos: true, dismissedUntil: dismissedUntilFrom(now) }), "hidden");
});
