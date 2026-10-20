import assert from "node:assert/strict";
import test from "node:test";
import { resolveVapidSubject } from "./vapid-subject.ts";

test("prefers an explicit https VAPID_SUBJECT", () => {
  assert.equal(resolveVapidSubject({ VAPID_SUBJECT: "https://studio.example/x", BETTER_AUTH_URL: "https://other.example" }), "https://studio.example");
});

test("skips mailto and http subjects and falls back to the app URL", () => {
  assert.equal(resolveVapidSubject({ VAPID_SUBJECT: "mailto:a@b.co", BETTER_AUTH_URL: "http://localhost:3010", NEXT_PUBLIC_APP_URL: "https://app.example" }), "https://app.example");
});

test("returns null when nothing usable is configured", () => {
  assert.equal(resolveVapidSubject({}), null);
  assert.equal(resolveVapidSubject({ VAPID_SUBJECT: "not a url" }), null);
});
