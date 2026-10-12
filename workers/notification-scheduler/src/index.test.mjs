import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import scheduler from "./index.ts";

const env = {
  APP_URL: "https://studio.example",
  CRON_SECRET: "test-cron-secret",
};

test("scheduler is configured to check once per minute", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.deepEqual(config.triggers.crons, ["* * * * *"]);
});

test("scheduled event calls the protected Studio processor", async (context) => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return new Response('{"processed":1,"sent":1,"failed":0,"skipped":0}', { status: 200 });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  let scheduledWork;
  await scheduler.scheduled(
    { cron: "* * * * *", scheduledTime: 1_800_000_000_000 },
    env,
    { waitUntil(promise) { scheduledWork = promise; } },
  );
  assert.ok(scheduledWork, "scheduled handler should register its work with waitUntil");
  await scheduledWork;

  assert.equal(request.url, "https://studio.example/api/notifications/process");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["x-cron-secret"], env.CRON_SECRET);
});

test("manual run endpoint rejects an incorrect scheduler secret", async () => {
  const response = await scheduler.fetch(
    new Request("https://scheduler.example/run", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    }),
    env,
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Not authorized." });
});

test("manual run endpoint reports the processor result when authorized", async (context) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"processed":1,"sent":1}', { status: 200 });
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await scheduler.fetch(
    new Request("https://scheduler.example/run", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    }),
    env,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    status: 200,
    body: '{"processed":1,"sent":1}',
  });
});
