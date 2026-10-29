interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface Env {
  APP_URL: string;
  CRON_SECRET: string;
  // Notifications stay paused unless this is explicitly "false".
  NOTIFICATIONS_PAUSED?: string;
  // Remembers when the app next needs to be called, so most ticks do nothing.
  SCHEDULE?: KvStore;
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

type RunOutcome = ProcessorResult & { skipped?: boolean };

const MINUTE = 60_000;
const NEXT_RUN_KEY = "next-run-at";
// After a failed run (for example the database is down or over quota) wait this
// long instead of calling again on the next tick.
const FAILURE_BACKOFF_MS = 10 * MINUTE;
// Never sleep less than a minute, or longer than two hours, whatever the app says.
const MIN_WAIT_MS = MINUTE;
const MAX_WAIT_MS = 120 * MINUTE;
// Used when the app does not say when to call next.
const DEFAULT_WAIT_MS = 20 * MINUTE;
// Without the KV binding there is nowhere to remember the next time, so fall back
// to a fixed grid rather than calling the app on every tick.
const FALLBACK_GRID_MINUTES = 20;

function notificationsPaused(env: Env) {
  return env.NOTIFICATIONS_PAUSED?.trim().toLowerCase() !== "false";
}

async function processNotifications(env: Env): Promise<ProcessorResult> {
  // Paused: do not call the app at all, so nothing reaches the database.
  if (notificationsPaused(env)) return { status: 200, body: '{"paused":true}' };

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
// bad or stale answer can neither hammer the database nor sleep for a day.
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

async function isDue(env: Env, scheduledTime: number) {
  if (!env.SCHEDULE) {
    console.error("Studio scheduler has no SCHEDULE KV binding; running on a fixed grid instead.");
    return Math.floor(scheduledTime / MINUTE) % FALLBACK_GRID_MINUTES === 0;
  }
  const stored = Number(await env.SCHEDULE.get(NEXT_RUN_KEY));
  // Nothing stored yet (first run) or an unreadable value: call the app.
  if (!Number.isFinite(stored) || stored <= 0) return true;
  return scheduledTime >= stored;
}

async function remember(env: Env, nextRunAt: number) {
  if (!env.SCHEDULE) return;
  try {
    await env.SCHEDULE.put(NEXT_RUN_KEY, String(nextRunAt));
  } catch (error: unknown) {
    // A missed write only means the next tick calls the app again.
    console.error("Studio scheduler could not save the next run time", error instanceof Error ? error.message : String(error));
  }
}

// Calls the app, then remembers when to call next. A failure backs off instead of
// retrying on the very next tick.
async function runAndSchedule(env: Env, now: number): Promise<ProcessorResult> {
  if (notificationsPaused(env)) return processNotifications(env);
  try {
    const result = await processNotifications(env);
    await remember(env, nextRunFromBody(result.body, now));
    return result;
  } catch (error: unknown) {
    await remember(env, now + FAILURE_BACKOFF_MS);
    throw error;
  }
}

async function runIfDue(env: Env, scheduledTime: number): Promise<RunOutcome> {
  if (notificationsPaused(env)) return processNotifications(env);
  if (!(await isDue(env, scheduledTime))) return { status: 204, body: "", skipped: true };
  return runAndSchedule(env, scheduledTime);
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
  async scheduled(controller: SchedulerController, env: Env, context: SchedulerExecutionContext) {
    context.waitUntil(
      runIfDue(env, controller.scheduledTime).then((result) => {
        // Most ticks are skipped; only log the ones that did something.
        if (result.skipped) return;
        console.log("Studio notifications processed", {
          cron: controller.cron,
          scheduledTime: controller.scheduledTime,
          status: result.status,
          body: result.body,
        });
      }).catch((error: unknown) => {
        console.error("Studio notification processing failed", {
          cron: controller.cron,
          scheduledTime: controller.scheduledTime,
          error: error instanceof Error ? error.message : String(error),
        });
      }),
    );
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz" && request.method === "GET") {
      return Response.json({ ok: true, service: "studio-notification-scheduler" });
    }

    if (url.pathname === "/run" && request.method === "POST") {
      if (!(await isAuthorized(request, env))) {
        return Response.json({ error: "Not authorized." }, { status: 401 });
      }

      try {
        const result = await runAndSchedule(env, Date.now());
        return Response.json({ ok: true, ...result });
      } catch (error: unknown) {
        return Response.json(
          { ok: false, error: error instanceof Error ? error.message : String(error) },
          { status: 502 },
        );
      }
    }

    return new Response("Not found.", { status: 404 });
  },
} satisfies SchedulerHandler<Env>;
