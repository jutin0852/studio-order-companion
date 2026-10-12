import assert from "node:assert/strict";
import test from "node:test";
import { isDueSoonDay } from "./reminder-days.ts";

test("default due-soon reminders are three and two days before the due date", () => {
  assert.equal(isDueSoonDay(3), true);
  assert.equal(isDueSoonDay(2), true);
  assert.equal(isDueSoonDay(1), false);
  assert.equal(isDueSoonDay(0), false);
});

test("custom due-soon days are respected", () => {
  assert.equal(isDueSoonDay(5, [5, 1]), true);
  assert.equal(isDueSoonDay(3, [5, 1]), false);
});

test("invalid fractional intervals never match", () => {
  assert.equal(isDueSoonDay(2.5), false);
});
