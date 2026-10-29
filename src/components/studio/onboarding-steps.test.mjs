import assert from "node:assert/strict";
import test from "node:test";
import { completedSetupSteps, nextSetupStep, setupComplete, setupSteps } from "./onboarding-steps.ts";

const none = { hasProduct: false, hasOrder: false, remindersOn: false, hasLogo: false };

test("a brand-new owner starts at the first step with nothing done", () => {
  const steps = setupSteps(none);
  assert.deepEqual(steps.map((step) => step.id), ["product", "order", "reminders", "logo"]);
  assert.equal(completedSetupSteps(steps), 0);
  assert.equal(nextSetupStep(steps)?.id, "product");
  assert.equal(setupComplete(steps), false);
});

test("steps complete from real data and the next step moves on", () => {
  const steps = setupSteps({ ...none, hasProduct: true, hasOrder: true });
  assert.equal(completedSetupSteps(steps), 2);
  assert.equal(nextSetupStep(steps)?.id, "reminders");
});

test("the next step is the first one left, even if a later one is already done", () => {
  const steps = setupSteps({ ...none, hasOrder: true, hasLogo: true });
  assert.equal(nextSetupStep(steps)?.id, "product");
});

test("finishing every step completes setup", () => {
  const steps = setupSteps({ hasProduct: true, hasOrder: true, remindersOn: true, hasLogo: true });
  assert.equal(setupComplete(steps), true);
  assert.equal(nextSetupStep(steps), null);
});

test("every step has a page to go to", () => {
  for (const step of setupSteps(none)) assert.match(step.href, /^\//);
});

test("the reminders step is left out while notifications are paused, so setup can still finish", () => {
  const steps = setupSteps({ ...none, remindersPaused: true });
  assert.deepEqual(steps.map((step) => step.id), ["product", "order", "logo"]);
  assert.equal(setupComplete(setupSteps({ hasProduct: true, hasOrder: true, remindersOn: false, remindersPaused: true, hasLogo: true })), true);
});
