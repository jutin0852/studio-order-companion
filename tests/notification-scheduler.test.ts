import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createOrder } from "@/app/api/orders/route";
import { PATCH as updateOrder } from "@/app/api/orders/[id]/route";
import { PATCH as snoozeOrder } from "@/app/api/orders/[id]/snooze/route";
import { PATCH as updatePreferences } from "@/app/api/notifications/preferences/route";
import { rescheduleNotifications } from "@/lib/notification-scheduler";
import { alice, jsonRequest, readJson, routeParams, signInAs } from "./helpers/session";

const pending = vi.hoisted(() => [] as Promise<unknown>[]);

// `after` needs a live request; run the callback right away and keep its promise.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => Promise<unknown>) => { pending.push(callback()); },
}));

const settle = async () => {
  await Promise.all(pending);
  pending.length = 0;
};

const newOrder = { customerName: "Ada", productName: "Gown", amountPaid: 1000, dueDate: "2026-12-01" };

describe("telling the scheduler about changes", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await signInAs(alice);
    process.env.NOTIFICATIONS_SCHEDULER_URL = "https://scheduler.example";
    process.env.CRON_SECRET = "scheduler-secret";
    fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NOTIFICATIONS_SCHEDULER_URL;
    process.env.STUDIO_NOTIFICATIONS_PAUSED = "false";
  });

  it("calls the Worker's reschedule endpoint with the shared secret", async () => {
    rescheduleNotifications();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://scheduler.example/reschedule");
    expect(init).toMatchObject({ method: "POST", headers: { authorization: "Bearer scheduler-secret" } });
  });

  it("does nothing while notifications are paused", async () => {
    process.env.STUDIO_NOTIFICATIONS_PAUSED = "true";
    rescheduleNotifications();
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing until the Worker's address is configured", async () => {
    delete process.env.NOTIFICATIONS_SCHEDULER_URL;
    rescheduleNotifications();
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("runs after creating an order, changing one, snoozing and changing preferences", async () => {
    const created = await readJson<{ order: { id: string } }>(await createOrder(jsonRequest("/api/orders", "POST", newOrder)));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const id = created.order.id;
    await updateOrder(jsonRequest(`/api/orders/${id}`, "PATCH", { status: "in_progress" }), routeParams(id));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await snoozeOrder(jsonRequest(`/api/orders/${id}/snooze`, "PATCH", { snoozedUntil: "2026-11-20" }), routeParams(id));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await updatePreferences(jsonRequest("/api/notifications/preferences", "PATCH", { awakeStart: "07:00" }));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not run when a save is rejected", async () => {
    const response = await createOrder(jsonRequest("/api/orders", "POST", { customerName: "" }));
    await settle();
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a scheduler that is down never fails the save", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("offline"));
    const response = await createOrder(jsonRequest("/api/orders", "POST", newOrder));
    await settle();
    expect(response.status).toBe(201);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});
