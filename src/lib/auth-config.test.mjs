import assert from "node:assert/strict";
import test from "node:test";
import { buildAllowedHosts, resolveAuthSecret } from "./auth-config.ts";

const longSecret = "x".repeat(32);

test("production without a secret leaves auth unconfigured", () => {
  const result = resolveAuthSecret({ NODE_ENV: "production" });
  assert.equal(result.configured, false);
  assert.equal(result.secret, null);
});

test("production rejects a short secret", () => {
  assert.equal(resolveAuthSecret({ NODE_ENV: "production", BETTER_AUTH_SECRET: "short" }).configured, false);
});

test("production accepts a long secret", () => {
  assert.deepEqual(resolveAuthSecret({ NODE_ENV: "production", BETTER_AUTH_SECRET: ` ${longSecret} ` }), { configured: true, secret: longSecret });
});

test("development uses a stable fallback secret", () => {
  const first = resolveAuthSecret({ NODE_ENV: "development" });
  const second = resolveAuthSecret({ NODE_ENV: "development" });
  assert.equal(first.configured, true);
  assert.equal(first.secret, second.secret);
});

test("production hosts exclude LAN and nip.io development hosts", () => {
  const hosts = buildAllowedHosts({ NODE_ENV: "production", BETTER_AUTH_ALLOWED_HOSTS: "extra.example.com, " }, "https://studio.example.com");
  assert.deepEqual(hosts, ["studio.example.com", "extra.example.com"]);
});

test("development hosts include localhost and LAN hosts without duplicates", () => {
  const hosts = buildAllowedHosts({ NODE_ENV: "development", BETTER_AUTH_ALLOWED_HOSTS: "localhost:3010" }, "http://localhost:3010");
  assert.equal(hosts.filter((host) => host === "localhost:3010").length, 1);
  assert.ok(hosts.includes("192.168.1.3:3010"));
});
