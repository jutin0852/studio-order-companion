import { beforeEach, describe, expect, it } from "vitest";
import { POST as createOrderRoute } from "@/app/api/orders/route";
import { GET as listReceipts, POST as createReceiptRoute } from "@/app/api/receipts/route";
import { POST as voidReceiptRoute } from "@/app/api/receipts/[id]/void/route";
import { GET as getSettings, PUT as putSettings } from "@/app/api/receipts/settings/route";
import { alice, bob, jsonRequest, readJson, routeParams, signInAs } from "./helpers/session";

type ReceiptJson = { id: string; number: number; orderId: string | null; amount: number; paymentMethod: string; voided: boolean };

const logo = "https://res.cloudinary.com/demo/image/upload/v1/studio/users/u1/logos/a.webp";

async function newOrderId() {
  const response = await createOrderRoute(jsonRequest("/api/orders", "POST", { customerName: "Amaka", productName: "Gown", amountPaid: 45_000, dueDate: "2026-12-01" }));
  return (await readJson<{ order: { id: string } }>(response)).order.id;
}

const receiptBody = (orderId: string | null, overrides: Record<string, unknown> = {}) => ({
  orderId,
  receivedFrom: "Amaka Okafor",
  paymentFor: "Ankara gown",
  amount: 45_000,
  paymentMethod: "transfer",
  date: "2026-10-20",
  ...overrides,
});

async function createReceipt(orderId: string | null, overrides: Record<string, unknown> = {}) {
  const response = await createReceiptRoute(jsonRequest("/api/receipts", "POST", receiptBody(orderId, overrides)));
  return { response, receipt: (await readJson<{ receipt: ReceiptJson }>(response)).receipt };
}

describe("receipt settings API", () => {
  beforeEach(() => signInAs(alice));

  it("requires sign-in", async () => {
    await signInAs(null);
    expect((await getSettings()).status).toBe(401);
    expect((await putSettings(jsonRequest("/api/receipts/settings", "PUT", {}))).status).toBe(401);
  });

  it("returns defaults, then saves cleaned-up details", async () => {
    const defaults = await readJson<{ settings: Record<string, unknown> }>(await getSettings());
    expect(defaults.settings).toMatchObject({ brandColor: "#B3273A", address: "", instagram: "" });

    const saved = await putSettings(jsonRequest("/api/receipts/settings", "PUT", {
      brandColor: "#1f6f5c", logo, address: "  6A,   5th Avenue ", phone: "0802 329 7930", instagram: "@gladstyle", tiktok: "glad.style",
    }));
    expect(saved.status).toBe(200);
    expect((await readJson<{ settings: Record<string, unknown> }>(saved)).settings).toMatchObject({
      brandColor: "#1F6F5C", logo, address: "6A, 5th Avenue", phone: "0802 329 7930", instagram: "gladstyle", tiktok: "glad.style",
    });
  });

  it("rejects invalid colours, logos, phone numbers and handles", async () => {
    for (const bad of [{ brandColor: "red" }, { logo: "https://example.com/logo.png" }, { phone: "call me" }, { instagram: "has spaces" }, { address: "a".repeat(161) }]) {
      expect((await putSettings(jsonRequest("/api/receipts/settings", "PUT", bad))).status, JSON.stringify(bad)).toBe(400);
    }
  });
});

describe("receipts API", () => {
  beforeEach(() => signInAs(alice));

  it("requires sign-in", async () => {
    await signInAs(null);
    expect((await createReceiptRoute(jsonRequest("/api/receipts", "POST", receiptBody(null)))).status).toBe(401);
    expect((await listReceipts(jsonRequest("/api/receipts?orderId=x", "GET"))).status).toBe(401);
  });

  it("numbers receipts 1, 2, 3 for a business and lists them newest first", async () => {
    const orderId = await newOrderId();
    const first = await createReceipt(orderId);
    const second = await createReceipt(orderId, { amount: 1500.5, paymentMethod: "cash" });
    expect(first.response.status).toBe(201);
    expect([first.receipt.number, second.receipt.number]).toEqual([expect.any(Number), first.receipt.number + 1]);
    expect(second.receipt).toMatchObject({ amount: 1500.5, paymentMethod: "cash", voided: false });

    const list = await readJson<{ receipts: ReceiptJson[] }>(await listReceipts(jsonRequest(`/api/receipts?orderId=${orderId}`, "GET")));
    expect(list.receipts.map((item) => item.number)).toEqual([second.receipt.number, first.receipt.number]);
  });

  it("starts each business at receipt number 1", async () => {
    await signInAs(bob);
    const { receipt } = await createReceipt(await newOrderId());
    expect(receipt.number).toBe(1);
  });

  it("rejects bad receipts", async () => {
    const orderId = await newOrderId();
    for (const bad of [{ amount: -5 }, { amount: 0 }, { amount: "lots" }, { paymentMethod: "bitcoin" }, { date: "2026-13-45" }, { receivedFrom: "   " }, { paymentFor: "x".repeat(201) }, { receivedFrom: "x".repeat(161) }]) {
      const response = await createReceiptRoute(jsonRequest("/api/receipts", "POST", receiptBody(orderId, bad)));
      expect(response.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("only allows receipts for the caller's own orders", async () => {
    const aliceOrder = await newOrderId();
    expect((await createReceiptRoute(jsonRequest("/api/receipts", "POST", receiptBody("00000000-0000-4000-8000-000000000000")))).status).toBe(404);

    await signInAs(bob);
    expect((await createReceiptRoute(jsonRequest("/api/receipts", "POST", receiptBody(aliceOrder)))).status).toBe(404);
    const bobsList = await readJson<{ receipts: ReceiptJson[] }>(await listReceipts(jsonRequest(`/api/receipts?orderId=${aliceOrder}`, "GET")));
    expect(bobsList.receipts).toEqual([]);
  });

  it("voids a receipt but keeps its number, and blocks other businesses", async () => {
    const { receipt } = await createReceipt(await newOrderId());

    await signInAs(bob);
    expect((await voidReceiptRoute(jsonRequest(`/api/receipts/${receipt.id}/void`, "POST"), routeParams(receipt.id))).status).toBe(404);

    await signInAs(alice);
    const voided = await voidReceiptRoute(jsonRequest(`/api/receipts/${receipt.id}/void`, "POST"), routeParams(receipt.id));
    expect(await readJson<{ receipt: ReceiptJson }>(voided)).toMatchObject({ receipt: { id: receipt.id, number: receipt.number, voided: true } });

    const next = await createReceipt(receipt.orderId);
    expect(next.receipt.number).toBe(receipt.number + 1);
    expect((await voidReceiptRoute(jsonRequest("/api/receipts/nope/void", "POST"), routeParams("nope"))).status).toBe(404);
  });

  it("freezes branding on a receipt when settings change later", async () => {
    await putSettings(jsonRequest("/api/receipts/settings", "PUT", { brandColor: "#1F6F5C" }));
    const { receipt } = await createReceipt(await newOrderId());
    await putSettings(jsonRequest("/api/receipts/settings", "PUT", { brandColor: "#3B4FB8" }));

    const { db } = await import("@/lib/db");
    const stored = await db!.query<{ branding: { color: string } }>("SELECT branding FROM receipts WHERE id = $1::uuid", [receipt.id]);
    expect(stored.rows[0].branding.color).toBe("#1F6F5C");
  });
});
