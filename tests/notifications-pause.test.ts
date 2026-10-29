import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { POST as processRoute } from "@/app/api/notifications/process/route";
import { POST as testRoute } from "@/app/api/notifications/test/route";
import { DELETE as unsubscribeRoute, POST as subscribeRoute } from "@/app/api/notifications/subscription/route";
import { POST as createOrderRoute } from "@/app/api/orders/route";
import { PATCH as updateOrderRoute } from "@/app/api/orders/[id]/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { processDueNotifications } from "@/lib/notifications";
import { notificationsPaused } from "@/lib/notifications-pause";
import { sendPushToUser } from "@/lib/push";
import { alice, jsonRequest, readJson, routeParams, signInAs } from "./helpers/session";

const setPaused = (value: string | undefined) => {
  if (value === undefined) delete process.env.STUDIO_NOTIFICATIONS_PAUSED;
  else process.env.STUDIO_NOTIFICATIONS_PAUSED = value;
};

describe("notifications pause switch", () => {
  afterEach(() => setPaused("false"));

  it("is paused unless explicitly switched off", () => {
    expect(notificationsPaused({})).toBe(true);
    expect(notificationsPaused({ STUDIO_NOTIFICATIONS_PAUSED: "" })).toBe(true);
    expect(notificationsPaused({ STUDIO_NOTIFICATIONS_PAUSED: "true" })).toBe(true);
    expect(notificationsPaused({ STUDIO_NOTIFICATIONS_PAUSED: "garbage" })).toBe(true);
    expect(notificationsPaused({ STUDIO_NOTIFICATIONS_PAUSED: "false" })).toBe(false);
    expect(notificationsPaused({ STUDIO_NOTIFICATIONS_PAUSED: " False " })).toBe(false);
  });

  it("does not resume by itself because of a date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T00:00:00Z"));
    expect(notificationsPaused({ STUDIO_NOTIFICATIONS_PAUSED: "true" })).toBe(true);
    vi.useRealTimers();
  });
});

describe("while notifications are paused", () => {
  let queries: MockInstance;

  beforeEach(() => {
    setPaused("true");
    process.env.CRON_SECRET = "pause-test-secret";
    vi.mocked(auth.api.getSession).mockClear();
    queries = vi.spyOn(db!, "query");
  });
  afterEach(() => {
    queries.mockRestore();
    setPaused("false");
  });

  it("processDueNotifications makes zero database queries", async () => {
    expect(await processDueNotifications(new Date("2026-11-02T10:00:00Z"))).toEqual({ paused: true, processed: 0, sent: 0, failed: 0, skipped: 0 });
    expect(queries).not.toHaveBeenCalled();
  });

  it("sendPushToUser makes zero database queries and sends nothing", async () => {
    expect(await sendPushToUser(alice.id, { title: "t", body: "b" })).toMatchObject({ paused: true, sent: 0, failed: 0, removed: 0 });
    expect(queries).not.toHaveBeenCalled();
  });

  it("the scheduler endpoint answers 200 paused without touching the database", async () => {
    const response = await processRoute(new Request("http://localhost/api/notifications/process", { method: "POST", headers: { "x-cron-secret": "pause-test-secret" } }));
    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({ paused: true, processed: 0, sent: 0 });
    expect(queries).not.toHaveBeenCalled();
  });

  it("the scheduler endpoint still rejects a wrong secret", async () => {
    const response = await processRoute(new Request("http://localhost/api/notifications/process", { method: "POST", headers: { "x-cron-secret": "wrong" } }));
    expect(response.status).toBe(401);
    expect(queries).not.toHaveBeenCalled();
  });

  it("send-test, subscribe and unsubscribe are refused before any session or database work", async () => {
    await signInAs(alice);
    queries.mockClear();
    vi.mocked(auth.api.getSession).mockClear();

    const test = await testRoute();
    const subscribe = await subscribeRoute(jsonRequest("/api/notifications/subscription", "POST", {}));
    const unsubscribe = await unsubscribeRoute(jsonRequest("/api/notifications/subscription", "DELETE", {}));

    for (const response of [test, subscribe, unsubscribe]) {
      expect(response.status).toBe(503);
      expect(await readJson(response)).toMatchObject({ paused: true });
    }
    expect(auth.api.getSession).not.toHaveBeenCalled();
    expect(queries).not.toHaveBeenCalled();
  });

  it("marking an order ready or delivered still saves but does not look up or send a notification", async () => {
    await signInAs(alice);
    const created = await readJson<{ order: { id: string } }>(await createOrderRoute(jsonRequest("/api/orders", "POST", { customerName: "Ada", productName: "Gown", amountPaid: 1000, dueDate: "2026-12-01" })));
    queries.mockClear();

    const response = await updateOrderRoute(jsonRequest(`/api/orders/${created.order.id}`, "PATCH", { status: "ready" }), routeParams(created.order.id));
    expect(response.status).toBe(200);
    expect(await readJson<{ order: { status: string } }>(response)).toMatchObject({ order: { status: "ready" } });
    const sql = queries.mock.calls.map(([text]) => String(text));
    expect(sql.some((text) => text.includes("FROM notification_preferences WHERE user_id"))).toBe(false);
    expect(sql.some((text) => text.includes("push_subscriptions"))).toBe(false);
  });

  it("keeps stored subscriptions, preferences and reminders untouched", async () => {
    queries.mockRestore();
    await signInAs(alice);
    const count = async (table: string) => Number((await db!.query(`SELECT count(*) AS total FROM ${table}`)).rows[0].total);
    const before = [await count("push_subscriptions"), await count("notification_preferences"), await count("reminders")];
    await processDueNotifications();
    await testRoute();
    await unsubscribeRoute(jsonRequest("/api/notifications/subscription", "DELETE", { endpoint: "https://fcm.googleapis.com/fcm/send/x" }));
    expect([await count("push_subscriptions"), await count("notification_preferences"), await count("reminders")]).toEqual(before);
  });
});
