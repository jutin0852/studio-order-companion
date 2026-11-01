import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import scheduler, { NotificationScheduler } from "./index.ts";

const MINUTE = 60_000;
const SECRET = "test-cron-secret";
const baseEnv = { APP_URL: "https://studio.example", CRON_SECRET: SECRET, NOTIFICATIONS_PAUSED: "false" };

// A stand-in for the Durable Object: one alarm slot, and a namespace whose stub
// runs the real NotificationScheduler class.
function fakeScheduler(env) {
  let alarm = null;
  const state = {
    storage: {
      async getAlarm() { return alarm; },
      async setAlarm(time) { alarm = time; },
    },
  };
  const object = new NotificationScheduler(state, env);
  const namespace = {
    idFromName: (name) => name,
    get: () => ({ fetch: (request) => object.fetch(request) }),
  };
  return { object, namespace, alarm: () => alarm, setAlarm: (time) => { alarm = time; } };
}

function setup(overrides = {}) {
  const env = { ...baseEnv, ...overrides };
  const fake = fakeScheduler(env);
  env.SCHEDULER = fake.namespace;
  return { env, ...fake };
}

function stubFetch(context, respond) {
  const original = globalThis.fetch;
  const state = { calls: [] };
  globalThis.fetch = async (input, init) => {
    state.calls.push({ url: String(input), init });
    return respond();
  };
  context.after(() => { globalThis.fetch = original; });
  return state;
}

function quiet(context) {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  context.after(() => {
    console.log = originalLog;
    console.error = originalError;
  });
}

async function watchdog(env) {
  let work;
  await scheduler.scheduled({ cron: "*/30 * * * *", scheduledTime: Date.now() }, env, { waitUntil(promise) { work = promise; } });
  await work;
}

const answer = (nextRunAt) => new Response(JSON.stringify({ processed: 0, sent: 0, failed: 0, skipped: 0, nextRunAt }), { status: 200 });

test("the watchdog starts the alarm when there is none, without calling the app", async (context) => {
  quiet(context);
  const fetches = stubFetch(context, () => answer(new Date().toISOString()));
  const { env, alarm } = setup();
  const before = Date.now();
  await watchdog(env);
  assert.ok(alarm() >= before && alarm() <= Date.now(), "alarm set for now");
  assert.equal(fetches.calls.length, 0);
});

test("the watchdog leaves an existing alarm alone", async (context) => {
  quiet(context);
  const { env, alarm, setAlarm } = setup();
  const later = Date.now() + 45 * MINUTE;
  setAlarm(later);
  await watchdog(env);
  assert.equal(alarm(), later);
});

test("the alarm calls the app once and sets the next alarm to the time it returns", async (context) => {
  quiet(context);
  const next = Date.now() + 47 * MINUTE;
  const fetches = stubFetch(context, () => answer(new Date(next).toISOString()));
  const { object, alarm } = setup();
  await object.alarm();
  assert.equal(fetches.calls.length, 1);
  assert.equal(fetches.calls[0].url, "https://studio.example/api/notifications/process");
  assert.equal(fetches.calls[0].init.method, "POST");
  assert.equal(fetches.calls[0].init.headers["x-cron-secret"], SECRET);
  assert.equal(alarm(), next);
});

test("nothing calls the app between alarms", async (context) => {
  quiet(context);
  const fetches = stubFetch(context, () => answer(new Date(Date.now() + 30 * MINUTE).toISOString()));
  const { env, object, setAlarm } = setup();
  setAlarm(Date.now() + 30 * MINUTE);
  for (let index = 0; index < 5; index += 1) await watchdog(env);
  assert.equal(fetches.calls.length, 0, "only the alarm calls the app");
  await object.alarm();
  assert.equal(fetches.calls.length, 1);
});

test("the next alarm is kept between one minute and two hours from now", async (context) => {
  quiet(context);
  const { object, alarm } = setup();

  stubFetch(context, () => answer(new Date(Date.now() - 10 * MINUTE).toISOString()));
  let before = Date.now();
  await object.alarm();
  assert.ok(alarm() >= before + MINUTE && alarm() <= Date.now() + MINUTE, "a time in the past cannot make it spin");

  stubFetch(context, () => answer(new Date(Date.now() + 24 * 60 * MINUTE).toISOString()));
  before = Date.now();
  await object.alarm();
  assert.ok(alarm() >= before + 120 * MINUTE && alarm() <= Date.now() + 120 * MINUTE, "a far-off time cannot go quiet for a day");
});

test("an answer without a usable time waits 20 minutes", async (context) => {
  quiet(context);
  const { object, alarm } = setup();

  stubFetch(context, () => new Response('{"processed":0}', { status: 200 }));
  let before = Date.now();
  await object.alarm();
  assert.ok(alarm() >= before + 20 * MINUTE && alarm() <= Date.now() + 20 * MINUTE);

  stubFetch(context, () => new Response("not json", { status: 200 }));
  before = Date.now();
  await object.alarm();
  assert.ok(alarm() >= before + 20 * MINUTE && alarm() <= Date.now() + 20 * MINUTE);
});

test("a failed run sets the next alarm ten minutes out so the chain does not break", async (context) => {
  quiet(context);
  const fetches = stubFetch(context, () => new Response('{"error":"The notification processor failed."}', { status: 503 }));
  const { object, alarm } = setup();
  const before = Date.now();
  await object.alarm();
  assert.equal(fetches.calls.length, 1);
  assert.ok(alarm() >= before + 10 * MINUTE && alarm() <= Date.now() + 10 * MINUTE);
});

test("paused: the alarm does not call the app and does not set another", async (context) => {
  quiet(context);
  const fetches = stubFetch(context, () => answer(new Date().toISOString()));
  for (const NOTIFICATIONS_PAUSED of ["true", undefined, ""]) {
    const { env, object, alarm } = setup({ NOTIFICATIONS_PAUSED });
    await object.alarm();
    await watchdog(env);
    assert.equal(alarm(), null);
  }
  assert.equal(fetches.calls.length, 0);
});

test("manual run rejects an incorrect scheduler secret", async () => {
  const { env } = setup();
  const response = await scheduler.fetch(
    new Request("https://scheduler.example/run", { method: "POST", headers: { authorization: "Bearer wrong-secret" } }),
    env,
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Not authorized." });
});

test("manual run calls the app and sets the next alarm when authorized", async (context) => {
  quiet(context);
  const next = Date.now() + 25 * MINUTE;
  const fetches = stubFetch(context, () => answer(new Date(next).toISOString()));
  const { env, alarm } = setup();
  const response = await scheduler.fetch(
    new Request("https://scheduler.example/run", { method: "POST", headers: { authorization: `Bearer ${SECRET}` } }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(fetches.calls.length, 1);
  assert.equal(alarm(), next);
});

test("manual run reports a processor failure as 502", async (context) => {
  quiet(context);
  stubFetch(context, () => new Response("{}", { status: 503 }));
  const { env } = setup();
  const response = await scheduler.fetch(
    new Request("https://scheduler.example/run", { method: "POST", headers: { authorization: `Bearer ${SECRET}` } }),
    env,
  );
  assert.equal(response.status, 502);
  assert.equal((await response.json()).ok, false);
});

test("the worker is not scheduled every minute, and ships paused with the alarm object bound", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.deepEqual(config.triggers.crons, ["*/30 * * * *"]);
  assert.notDeepEqual(config.triggers.crons, ["* * * * *"]);
  assert.equal(config.vars.NOTIFICATIONS_PAUSED, "true");
  assert.equal(config.durable_objects.bindings[0].name, "SCHEDULER");
  assert.equal(config.durable_objects.bindings[0].class_name, "NotificationScheduler");
  assert.deepEqual(config.migrations[0].new_sqlite_classes, ["NotificationScheduler"]);
});
