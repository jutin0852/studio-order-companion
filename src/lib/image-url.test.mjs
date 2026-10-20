import assert from "node:assert/strict";
import test from "node:test";
import { isStudioImageUrl } from "./image-url.ts";

const good = "https://res.cloudinary.com/demo/image/upload/v1/studio/users/u1/products/a.webp";

test("accepts a Cloudinary image from the configured account", () => {
  assert.equal(isStudioImageUrl(good, "demo"), true);
  assert.equal(isStudioImageUrl(good), true);
});

test("rejects other hosts, schemes, credentials and lookalike domains", () => {
  for (const value of [
    "https://example.com/a.png",
    "http://res.cloudinary.com/demo/image/upload/a.png",
    "https://res.cloudinary.com.evil.com/demo/image/upload/a.png",
    "https://user@res.cloudinary.com/demo/image/upload/a.png",
    "https://res.cloudinary.com:8443/demo/image/upload/a.png",
    "javascript:alert(1)",
    "not a url",
    "",
  ]) assert.equal(isStudioImageUrl(value, "demo"), false, value);
});

test("rejects another Cloudinary account and over-long or non-string values", () => {
  assert.equal(isStudioImageUrl(good, "other"), false);
  assert.equal(isStudioImageUrl(`${good}?${"a".repeat(2_000)}`, "demo"), false);
  assert.equal(isStudioImageUrl(null, "demo"), false);
  assert.equal(isStudioImageUrl(42, "demo"), false);
});
