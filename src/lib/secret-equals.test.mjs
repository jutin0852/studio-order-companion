import assert from "node:assert/strict";
import test from "node:test";
import { secretEquals } from "./secret-equals.ts";

test("matches only identical secrets", () => {
  assert.equal(secretEquals("abc", "abc"), true);
  assert.equal(secretEquals("abd", "abc"), false);
  assert.equal(secretEquals("abc", "abcd"), false);
});

test("rejects missing values and never accepts an empty expected secret", () => {
  assert.equal(secretEquals(null, "abc"), false);
  assert.equal(secretEquals(undefined, undefined), false);
  assert.equal(secretEquals("", ""), false);
});
