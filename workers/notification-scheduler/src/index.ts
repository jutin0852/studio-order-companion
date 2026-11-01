// Calls Studio's notification processor at the time the app says is next, and
// not otherwise. A Durable Object holds one alarm; when it fires, the object
// calls the app, reads the next time from the answer and sets the alarm for it.
// There is no per-minute tick. When someone changes something that affects the
// times, the app calls /reschedule so the alarm is recalculated straight away.
// The cron trigger is only a slow watchdog that starts the alarm if it was never
// set (first deploy, or after a pause).

interface DurableObjectStorage {
  getAlarm(): Promise<number | null>;
  setAlarm(scheduledTime: number): Promise<void>;
}

interface DurableObjectState {
  storage: DurableObjectStorage;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
}

interface Env {
  APP_URL: string;
  CRON_SECRET: string;
  // Notifications stay paused unless this is explicitly "false".
  NOTIFICATIONS_PAUSED?: string;
  // Holds the alarm that says when to call the app next.
  SCHEDULER?: DurableObjectNamespace;
}

interface SchedulerController {
  cron: string;
  scheduledTime: number;
}

interface SchedulerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface SchedulerHandler<WorkerEnv> {
  scheduled(
    controller: SchedulerController,
    env: WorkerEnv,
    context: SchedulerExecutionContext,
  ): void | Promise<void>;
  fetch(request: Request, env: WorkerEnv): Response | Promise<Response>;
}

type ProcessorResult = {
  status: number;
  body: string;
};

const MINUTE = 60_000;
const OBJECT_NAME = "main";
const OBJECT_ORIGIN = "https://scheduler.internal";
// After a failed run (for example the database is down or over quota) wait this
// long before calling again.
const FAILURE_BACKOFF_MS = 10 * MINUTE;
// Never schedule sooner than a minute, or later than the two days the app can look
// ahead plus an hour, whatever the app says.
const MIN_WAIT_MS = MINUTE;
const MAX_WAIT_MS = 49 * 60 * MINUTE;
// A change waits this long before recalculating, so a burst of edits is one run.
const RESCHEDULE_DELAY_MS = MINUTE;
// Used when the app does not say when to call next.
const DEFAULT_WAIT_MS = 20 * MINUTE;

function notificationsPaused(env: Env) {
  return env.NOTIFICATIONS_PAUSED?.trim().toLowerCase() !== "false";
}

async function processNotifications(env: Env): Promise<ProcessorResult> {
  const processorUrl = new URL("/api/notifications/process", env.APP_URL);
  const response = await fetch(processorUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cron-secret": env.CRON_SECRET,
    },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Studio notification processor returned ${response.status}: ${body}`);
  }

  return { status: response.status, body };
}

// The app says when something can next be due. Keep that inside a sane range so a
// bad or stale answer can neither hammer the database nor go quiet for a day.
function nextRunFromBody(body: string, now: number) {
  let requested = Number.NaN;
  try {
    const parsed = JSON.parse(body) as { nextRunAt?: unknown };
    if (typeof parsed.nextRunAt === "string") requested = Date.parse(parsed.nextRunAt);
  } catch {
    // Not JSON: use the default wait below.
  }
  const target = Number.isFinite(requested) ? requested : now + DEFAULT_WAIT_MS;
  return Math.min(Math.max(target, now + MIN_WAIT_MS), now + MAX_WAIT_MS);
}

export class NotificationScheduler {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/arm" && request.method === "POST") {
      await this.arm(Date.now());
      return Response.json({ ok: true, alarmAt: await this.state.storage.getAlarm() });
    }

    if (pathname === "/reschedule" && request.method === "POST") {
      await this.reschedule(Date.now());
      return Response.json({ ok: true, alarmAt: await this.state.storage.getAlarm() });
    }

    if (pathname === "/run" && request.method === "POST") {
      try {
        const result = await this.run(Date.now());
        return Response.json({ ok: true, ...result });
      } catch (error: unknown) {
        return Response.json(
          { ok: false, error: error instanceof Error ? error.message : String(error) },
          { status: 502 },
        );
      }
    }

    return new Response("Not found.", { status: 404 });
  }

  // Runs at the time set by the previous run. Always sets the next alarm, even
  // after a failure, so the chain of alarms never breaks.
  async alarm() {
    try {
      const result = await this.run(Date.now());
      console.log("Studio notifications processed", { status: result.status, body: result.body });
    } catch (error: unknown) {
      console.error("Studio notification processing failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Starts the alarm only if none is set. Paused: nothing is started.
  private async arm(now: number) {
    if (notificationsPaused(this.env)) return;
    if ((await this.state.storage.getAlarm()) === null) await this.state.storage.setAlarm(now);
  }

  // Brings the alarm forward, never back: an alarm due sooner than this still fires.
  private async reschedule(now: number) {
    if (notificationsPaused(this.env)) return;
    const soon = now + RESCHEDULE_DELAY_MS;
    const current = await this.state.storage.getAlarm();
    if (current === null || current > soon) await this.state.storage.setAlarm(soon);
  }

  private async run(now: number): Promise<ProcessorResult> {
    // Paused: do not call the app at all and do not set another alarm, so nothing
    // reaches the database. The watchdog starts the alarm again after a resume.
    if (notificationsPaused(this.env)) return { status: 200, body: '{"paused":true}' };
    try {
      const result = await processNotifications(this.env);
      await this.state.storage.setAlarm(nextRunFromBody(result.body, now));
      return result;
    } catch (error: unknown) {
      await this.state.storage.setAlarm(now + FAILURE_BACKOFF_MS);
      throw error;
    }
  }
}

function schedulerStub(env: Env) {
  if (!env.SCHEDULER) return null;
  return env.SCHEDULER.get(env.SCHEDULER.idFromName(OBJECT_NAME));
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

// Hash both sides so the comparison is constant-time and length-independent.
async function isAuthorized(request: Request, env: Env) {
  if (!env.CRON_SECRET) return false;
  const [supplied, expected] = await Promise.all([
    digest(request.headers.get("authorization") ?? ""),
    digest(`Bearer ${env.CRON_SECRET}`),
  ]);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= supplied[index] ^ expected[index];
  return difference === 0;
}

export default {
  // A slow watchdog, not the schedule: it only makes sure an alarm exists.
  async scheduled(controller: SchedulerController, env: Env, context: SchedulerExecutionContext) {
    context.waitUntil((async () => {
      if (notificationsPaused(env)) return;
      const stub = schedulerStub(env);
      if (!stub) {
        console.error("Studio scheduler has no SCHEDULER Durable Object binding; nothing will be scheduled.");
        return;
      }
      await stub.fetch(new Request(`${OBJECT_ORIGIN}/arm`, { method: "POST" }));
    })().catch((error: unknown) => {
      console.error("Studio scheduler could not check its alarm", {
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
        error: error instanceof Error ? error.message : String(error),
      });
    }));
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz" && request.method === "GET") {
      return Response.json({ ok: true, service: "studio-notification-scheduler" });
    }

    if ((url.pathname === "/run" || url.pathname === "/reschedule") && request.method === "POST") {
      if (!(await isAuthorized(request, env))) {
        return Response.json({ error: "Not authorized." }, { status: 401 });
      }
      const stub = schedulerStub(env);
      if (!stub) return Response.json({ ok: false, error: "The SCHEDULER binding is missing." }, { status: 503 });
      return stub.fetch(new Request(`${OBJECT_ORIGIN}${url.pathname}`, { method: "POST" }));
    }

    return new Response("Not found.", { status: 404 });
  },
} satisfies SchedulerHandler<Env>;
