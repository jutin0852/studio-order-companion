import assert from "node:assert/strict";
import test from "node:test";
import { optionalText, requiredText } from "./field-limits.ts";

test("requiredText trims and enforces bounds", () => {
  assert.equal(requiredText("  Ada  ", 5), "Ada");
  assert.equal(requiredText("abcde", 5), "abcde");
  assert.equal(requiredText("abcdef", 5), null);
  assert.equal(requiredText("   ", 5), null);
  assert.equal(requiredText(7, 5), null);
  assert.equal(requiredText(undefined, 5), null);
});

test("optionalText allows blanks but rejects long or non-string input", () => {
  assert.equal(optionalText(undefined, 3), "");
  assert.equal(optionalText(null, 3), "");
  assert.equal(optionalText(" ab ", 3), "ab");
  assert.equal(optionalText("abcd", 3), null);
  assert.equal(optionalText({}, 3), null);
});
