import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/orders/route";
import { DELETE, PATCH } from "@/app/api/orders/[id]/route";
import { PATCH as SNOOZE } from "@/app/api/orders/[id]/snooze/route";
import { alice, bob, jsonRequest, readJson, routeParams, signInAs } from "./helpers/session";

type OrderJson = { id: string; customer: string; product: string; total: number; status: string; clientRequestId?: string };

const newOrder = (overrides: Record<string, unknown> = {}) => ({
  customerName: "Amaka Okafor",
  productName: "Ankara gown",
  amountPaid: 45_000,
  dueDate: "2026-12-01",
  ...overrides,
});

async function createOrder(overrides: Record<string, unknown> = {}) {
  const response = await POST(jsonRequest("/api/orders", "POST", newOrder(overrides)));
  const body = await readJson<{ order: OrderJson }>(response);
  return { response, order: body.order };
}

describe("orders API", () => {
  beforeEach(() => signInAs(alice));

  it("requires sign-in", async () => {
    await signInAs(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(jsonRequest("/api/orders", "POST", newOrder()))).status).toBe(401);
  });

  it("creates an order and lists it", async () => {
    const { response, order } = await createOrder({ customerName: "  Ada  " });
    expect(response.status).toBe(201);
    expect(order).toMatchObject({ customer: "Ada", product: "Ankara gown", total: 45_000, status: "not_started" });

    const list = await readJson<{ orders: OrderJson[] }>(await GET());
    expect(list.orders.map((item) => item.id)).toContain(order.id);
  });

  it("rejects bad input", async () => {
    for (const bad of [
      { customerName: "x".repeat(161) },
      { productName: "   " },
      { amountPaid: -5 },
      { amountPaid: "lots" },
      { dueDate: "tomorrow" },
      { status: "teleported" },
      { notes: "n".repeat(2001) },
    ]) {
      const response = await POST(jsonRequest("/api/orders", "POST", newOrder(bad)));
      expect(response.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("treats a replayed create as the same order and never moves its status backwards", async () => {
    const created = await createOrder({ clientRequestId: "req-1" });
    expect(created.response.status).toBe(201);

    const delivered = await PATCH(jsonRequest(`/api/orders/${created.order.id}`, "PATCH", { status: "delivered" }), routeParams(created.order.id));
    expect(delivered.status).toBe(200);

    // A stale retry from an offline client still says "not_started" and has edited notes.
    const replay = await createOrder({ clientRequestId: "req-1", status: "not_started", notes: "edited offline" });
    expect(replay.response.status).toBe(200);
    expect(replay.order.id).toBe(created.order.id);
    expect(replay.order.status).toBe("delivered");

    const list = await readJson<{ orders: OrderJson[] }>(await GET());
    expect(list.orders.filter((item) => item.clientRequestId === "req-1")).toHaveLength(1);
  });

  it("updates an order and validates changes", async () => {
    const { order } = await createOrder();
    const ok = await PATCH(jsonRequest(`/api/orders/${order.id}`, "PATCH", { customerName: "Chidi", status: "in_progress" }), routeParams(order.id));
    expect(await readJson<{ order: OrderJson }>(ok)).toMatchObject({ order: { customer: "Chidi", status: "in_progress" } });

    for (const bad of [{ customerName: "" }, { amountPaid: 0 }, { dueDate: "soon" }, { status: "lost" }, {}]) {
      const response = await PATCH(jsonRequest(`/api/orders/${order.id}`, "PATCH", bad), routeParams(order.id));
      expect(response.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("keeps each business's orders private", async () => {
    const { order } = await createOrder({ customerName: "Alice's customer" });

    await signInAs(bob);
    const bobsList = await readJson<{ orders: OrderJson[] }>(await GET());
    expect(bobsList.orders.map((item) => item.id)).not.toContain(order.id);
    expect((await PATCH(jsonRequest(`/api/orders/${order.id}`, "PATCH", { status: "ready" }), routeParams(order.id))).status).toBe(404);
    expect((await DELETE(jsonRequest(`/api/orders/${order.id}`, "DELETE"), routeParams(order.id))).status).toBe(404);
    expect((await SNOOZE(jsonRequest(`/api/orders/${order.id}/snooze`, "PATCH", { snoozedUntil: "2026-12-05" }), routeParams(order.id))).status).toBe(404);

    await signInAs(alice);
    const aliceList = await readJson<{ orders: OrderJson[] }>(await GET());
    expect(aliceList.orders.map((item) => item.id)).toContain(order.id);
  });

  it("snoozes, clears a snooze and rejects bad dates", async () => {
    const { order } = await createOrder();
    const snooze = (body: unknown) => SNOOZE(jsonRequest(`/api/orders/${order.id}/snooze`, "PATCH", body), routeParams(order.id));

    expect(await readJson(await snooze({ snoozedUntil: "2026-12-05" }))).toEqual({ snoozedUntil: "2026-12-05" });
    expect(await readJson(await snooze({ snoozedUntil: "2026-12-07" }))).toEqual({ snoozedUntil: "2026-12-07" });
    expect(await readJson(await snooze({ snoozedUntil: null }))).toEqual({ snoozedUntil: null });
    expect((await snooze({ snoozedUntil: "next week" })).status).toBe(400);
  });

  it("deletes an order and answers 404 for anything that is not an order id", async () => {
    const { order } = await createOrder();
    expect((await DELETE(jsonRequest(`/api/orders/${order.id}`, "DELETE"), routeParams(order.id))).status).toBe(200);
    expect((await DELETE(jsonRequest(`/api/orders/${order.id}`, "DELETE"), routeParams(order.id))).status).toBe(404);
    expect((await DELETE(jsonRequest("/api/orders/nope", "DELETE"), routeParams("nope"))).status).toBe(404);
  });
});
