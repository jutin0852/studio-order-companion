interface Env {
  APP_URL: string;
  CRON_SECRET: string;
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

function isAuthorized(request: Request, env: Env) {
  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${env.CRON_SECRET}`;
}

export default {
  async scheduled(controller: SchedulerController, env: Env, context: SchedulerExecutionContext) {
    context.waitUntil(
      processNotifications(env).then((result) => {
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
      if (!isAuthorized(request, env)) {
        return Response.json({ error: "Not authorized." }, { status: 401 });
      }

      try {
        const result = await processNotifications(env);
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
