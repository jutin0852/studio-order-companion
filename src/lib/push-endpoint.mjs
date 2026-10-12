import { parse } from "node:url";

const exactPushHosts = new Set([
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "updates.push.services.mozilla.com",
]);

export function canonicalPushEndpoint(value) {
  if (typeof value !== "string" || value.length > 4_096 || /[\u0000-\u0020\u007f]/.test(value)) return null;

  try {
    const url = new URL(value);
    const legacyUrl = parse(value);
    const isApplePushHost = url.hostname.endsWith(".push.apple.com");
    const isKnownPushHost = exactPushHosts.has(url.hostname) || isApplePushHost;
    const legacyParserAgrees = legacyUrl.protocol === url.protocol &&
      legacyUrl.hostname?.toLowerCase() === url.hostname && !legacyUrl.auth;

    if (
      url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hash !== "" ||
      Boolean(url.port && url.port !== "443") || !isKnownPushHost || !legacyParserAgrees || url.href !== value
    ) return null;

    return url.href;
  } catch {
    return null;
  }
}

export function isAllowedPushEndpoint(value) {
  return canonicalPushEndpoint(value) !== null;
}
