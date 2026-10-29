import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import scheduler from "./index.ts";

const MINUTE = 60_000;
const NEXT_RUN_KEY = "next-run-at";
// A minute boundary that is also on the 20-minute fallback grid.
const NOW = 30_000_000 * MINUTE;

function fakeKv(initial) {
  const store = new Map();
  if (initial !== undefined) store.set(NEXT_RUN_KEY, String(initial));
  return {
    store,
    async get(key) { return store.get(key) ?? null; },
    async put(key, value) { store.set(key, value); },
  };
}

const baseEnv = { APP_URL: "https://studio.example", CRON_SECRET: "test-cron-secret", NOTIFICATIONS_PAUSED: "false" };

async function tick(env, scheduledTime) {
  let work;
  await scheduler.scheduled({ cron: "* * * * *", scheduledTime }, env, { waitUntil(promise) { work = promise; } });
  await work;
}

function stubFetch(context, respond) {
  const original = globalThis.fetch;
  const state = { calls: 0 };
  globalThis.fetch = async () => {
    state.calls += 1;
    return respond();
  };
  context.after(() => { globalThis.fetch = original; });
  return state;
}

const okBody = (nextRunAt) => new Response(JSON.stringify({ processed: 0, sent: 0, failed: 0, skipped: 0, nextRunAt }), { status: 200 });
const savedMs = (kv) => Number(kv.store.get(NEXT_RUN_KEY));

test("a tick before the saved next run does nothing", async (context) => {
  const fetches = stubFetch(context, () => okBody(new Date(NOW + 30 * MINUTE).toISOString()));
  const kv = fakeKv(NOW + 5 * MINUTE);
  await tick({ ...baseEnv, SCHEDULE: kv }, NOW);
  await tick({ ...baseEnv, SCHEDULE: kv }, NOW + 4 * MINUTE);
  assert.equal(fetches.calls, 0);
  assert.equal(savedMs(kv), NOW + 5 * MINUTE, "the saved time is left alone");
});

test("a tick at or after the saved next run calls the app once and saves the time it returns", async (context) => {
  const next = NOW + 47 * MINUTE;
  const fetches = stubFetch(context, () => okBody(new Date(next).toISOString()));
  const kv = fakeKv(NOW);
  await tick({ ...baseEnv, SCHEDULE: kv }, NOW);
  assert.equal(fetches.calls, 1);
  assert.equal(savedMs(kv), next);

  await tick({ ...baseEnv, SCHEDULE: kv }, NOW + MINUTE);
  assert.equal(fetches.calls, 1, "the next tick is skipped");
});

test("the first ever tick, with nothing saved, calls the app", async (context) => {
  const fetches = stubFetch(context, () => okBody(new Date(NOW + 30 * MINUTE).toISOString()));
  await tick({ ...baseEnv, SCHEDULE: fakeKv() }, NOW);
  assert.equal(fetches.calls, 1);
});

test("the time the app asks for is kept between one minute and two hours from now", async (context) => {
  const kv = fakeKv();
  stubFetch(context, () => okBody(new Date(NOW - 10 * MINUTE).toISOString()));
  await tick({ ...baseEnv, SCHEDULE: kv }, NOW);
  assert.equal(savedMs(kv), NOW + MINUTE, "a time in the past cannot make it spin");

  stubFetch(context, () => okBody(new Date(NOW + 24 * 60 * MINUTE).toISOString()));
  await tick({ ...baseEnv, SCHEDULE: kv }, NOW + MINUTE);
  assert.equal(savedMs(kv), NOW + MINUTE + 120 * MINUTE, "a far-off time cannot sleep for a day");
});

test("an answer without a usable time waits 20 minutes", async (context) => {
  const kv = fakeKv();
  stubFetch(context, () => new Response('{"processed":0}', { status: 200 }));
  await tick({ ...baseEnv, SCHEDULE: kv }, NOW);
  assert.equal(savedMs(kv), NOW + 20 * MINUTE);

  stubFetch(context, () => new Response("not json", { status: 200 }));
  await tick({ ...baseEnv, SCHEDULE: kv }, NOW + 20 * MINUTE);
  assert.equal(savedMs(kv), NOW + 40 * MINUTE);
});

test("a failed run backs off ten minutes instead of retrying every tick", async (context) => {
  const kv = fakeKv();
  const fetches = stubFetch(context, () => new Response('{"error":"The notification processor failed."}', { status: 503 }));
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args);
  context.after(() => { console.error = originalError; });

  await tick({ ...baseEnv, SCHEDULE: kv }, NOW);
  assert.equal(fetches.calls, 1);
  assert.equal(savedMs(kv), NOW + 10 * MINUTE);
  assert.ok(logged.length > 0, "the failure is still logged");

  for (let minute = 1; minute < 10; minute += 1) await tick({ ...baseEnv, SCHEDULE: kv }, NOW + minute * MINUTE);
  assert.equal(fetches.calls, 1, "nine more ticks, no more calls");

  await tick({ ...baseEnv, SCHEDULE: kv }, NOW + 10 * MINUTE);
  assert.equal(fetches.calls, 2, "tries again once the wait is over");
});

test("without the KV binding it falls back to every 20 minutes, not every tick", async (context) => {
  const fetches = stubFetch(context, () => okBody(new Date(NOW + 30 * MINUTE).toISOString()));
  const originalError = console.error;
  console.error = () => {};
  context.after(() => { console.error = originalError; });

  let ticks = 0;
  for (let minute = 0; minute < 40; minute += 1) {
    await tick(baseEnv, NOW + minute * MINUTE);
    ticks += 1;
  }
  assert.equal(ticks, 40);
  assert.equal(fetches.calls, 2, "only the 00 and 20 minute marks");
});

test("a paused scheduler neither calls the app nor touches KV", async (context) => {
  const fetches = stubFetch(context, () => okBody(new Date(NOW + 30 * MINUTE).toISOString()));
  const kv = fakeKv();
  for (const NOTIFICATIONS_PAUSED of ["true", undefined]) {
    await tick({ ...baseEnv, NOTIFICATIONS_PAUSED, SCHEDULE: kv }, NOW);
    const manual = await scheduler.fetch(
      new Request("https://scheduler.example/run", { method: "POST", headers: { authorization: `Bearer ${baseEnv.CRON_SECRET}` } }),
      { ...baseEnv, NOTIFICATIONS_PAUSED, SCHEDULE: kv },
    );
    assert.equal(manual.status, 200);
  }
  assert.equal(fetches.calls, 0);
  assert.equal(kv.store.size, 0);
});

test("wrangler config keeps the one-minute tick and binds the KV store", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.deepEqual(config.triggers.crons, ["* * * * *"]);
  assert.equal(config.kv_namespaces[0].binding, "SCHEDULE");
});
