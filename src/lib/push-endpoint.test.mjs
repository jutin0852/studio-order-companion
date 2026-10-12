import assert from "node:assert/strict";
import test from "node:test";
import { canonicalPushEndpoint, isAllowedPushEndpoint } from "./push-endpoint.mjs";

test("accepts standard browser push service endpoints", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
    "https://web.push.apple.com/Q123/token",
    "https://subdomain.web.push.apple.com/token",
  ]) {
    assert.equal(isAllowedPushEndpoint(endpoint), true, endpoint);
  }
});

test("rejects arbitrary, local, downgraded, and malformed endpoints", () => {
  for (const endpoint of [
    "http://fcm.googleapis.com/fcm/send/token",
    "https://attacker.example/collect",
    "https://fcm.googleapis.com.attacker.example/collect",
    "https://localhost/push",
    "https://127.0.0.1/push",
    "https://[::1]/push",
    "https://user:pass@fcm.googleapis.com/fcm/send/token",
    "https://fcm.googleapis.com:8443/fcm/send/token",
    "https://fcm.googleapis.com/fcm/send/token#fragment",
    "https://%66cm.googleapis.com/fcm/send/token",
    "https://FCM.GOOGLEAPIS.COM/fcm/send/token",
    "https://fcm.googleapis.com:443/fcm/send/token",
    "not a URL",
  ]) {
    assert.equal(isAllowedPushEndpoint(endpoint), false, endpoint);
  }
});

test("returns only canonical endpoints whose WHATWG and legacy URL hosts agree", () => {
  assert.equal(
    canonicalPushEndpoint("https://fcm.googleapis.com/fcm/send/token"),
    "https://fcm.googleapis.com/fcm/send/token",
  );
  assert.equal(canonicalPushEndpoint("https://%66cm.googleapis.com/fcm/send/token"), null);
});
