import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, ensureUserWorkspace } from "@/lib/db";
import { processDueNotifications } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";
import { randomAlertSlots } from "@/lib/random-alerts";
import { alice, signInAs } from "./helpers/session";

vi.mock("@/lib/push", () => ({
  sendPushToUser: vi.fn(async () => ({ configured: true, sent: 1, removed: 0, failed: 0 })),
}));

const DATE = "2026-11-02";
// New businesses default to Africa/Lagos (UTC+1), so local 08:00 is 07:00 UTC.
const atLocalMinute = (minute: number) => new Date(Date.UTC(2026, 10, 2) + (minute - 60) * 60_000);
const slots = randomAlertSlots({ userId: alice.id, date: DATE, count: 3, startMinutes: 8 * 60, endMinutes: 21 * 60 });
const sent = () => vi.mocked(sendPushToUser);

let businessId: string;

async function addOrder(overrides: { status?: string; dueDate?: string; product?: string } = {}) {
  await db!.query(
    `INSERT INTO orders (business_id, product_name, customer_name, amount_paid, due_date, status)
     VALUES ($1, $2, 'Amaka', 45000, $3::date, $4)`,
    [businessId, overrides.product ?? "Ankara gown", overrides.dueDate ?? "2026-11-30", overrides.status ?? "in_progress"],
  );
}

describe("random check-ins", () => {
  beforeEach(async () => {
    await signInAs(alice);
    businessId = await ensureUserWorkspace(alice.id, alice.name);
    await db!.query("DELETE FROM reminders");
    await db!.query("DELETE FROM orders");
    await db!.query(
      "UPDATE notification_preferences SET push_enabled = true, random_alerts_enabled = true, random_alerts_per_day = 3, awake_start = '08:00', awake_end = '21:00' WHERE user_id = $1",
      [alice.id],
    );
    sent().mockClear();
    sent().mockResolvedValue({ configured: true, sent: 1, removed: 0, failed: 0 });
  });

  it("picks three times a day inside the awake hours", () => {
    expect(slots).toHaveLength(3);
    expect(slots.every((slot) => slot >= 8 * 60 && slot <= 21 * 60)).toBe(true);
  });

  it("sends nothing before the day's first check-in, or after the awake hours", async () => {
    await addOrder();
    await processDueNotifications(atLocalMinute(slots[0] - 5));
    await processDueNotifications(atLocalMinute(22 * 60 + 30));
    expect(sent()).not.toHaveBeenCalled();
  });

  it("sends one nudge about an order at a check-in time", async () => {
    await addOrder({ product: "Linen set" });
    const result = await processDueNotifications(atLocalMinute(slots[1]));

    expect(sent()).toHaveBeenCalledTimes(1);
    expect(sent()).toHaveBeenCalledWith(alice.id, expect.objectContaining({ kind: "random_nudge", body: expect.stringContaining("Linen set") }));
    expect(result.sent).toBe(1);
    const stored = await db!.query<{ kind: string; status: string }>("SELECT kind, status FROM reminders WHERE kind = 'random_nudge'");
    expect(stored.rows).toEqual([{ kind: "random_nudge", status: "sent" }]);
  });

  it("never sends the same check-in twice, even when the scheduler runs every minute", async () => {
    await addOrder();
    for (let minute = slots[0]; minute <= slots[0] + 30; minute += 1) await processDueNotifications(atLocalMinute(minute));
    expect(sent()).toHaveBeenCalledTimes(1);
  });

  it("sends each of the day's check-ins once", async () => {
    await addOrder();
    for (const slot of slots) {
      await processDueNotifications(atLocalMinute(slot));
      await processDueNotifications(atLocalMinute(slot + 1));
    }
    expect(sent()).toHaveBeenCalledTimes(3);
  });

  it("stays quiet when turned off, when push is off, or when there is nothing to do", async () => {
    await addOrder();
    await db!.query("UPDATE notification_preferences SET random_alerts_enabled = false WHERE user_id = $1", [alice.id]);
    await processDueNotifications(atLocalMinute(slots[0]));
    expect(sent()).not.toHaveBeenCalled();

    await db!.query("UPDATE notification_preferences SET random_alerts_enabled = true, push_enabled = false WHERE user_id = $1", [alice.id]);
    await processDueNotifications(atLocalMinute(slots[0]));
    expect(sent()).not.toHaveBeenCalled();

    await db!.query("UPDATE notification_preferences SET push_enabled = true WHERE user_id = $1", [alice.id]);
    await db!.query("DELETE FROM orders");
    await addOrder({ status: "delivered" });
    await processDueNotifications(atLocalMinute(slots[0]));
    expect(sent()).not.toHaveBeenCalled();
  });

  it("retries on the next run when no device received it, then stops once delivered", async () => {
    await addOrder();
    sent().mockResolvedValue({ configured: true, sent: 0, removed: 0, failed: 0 });
    await processDueNotifications(atLocalMinute(slots[0]));
    await processDueNotifications(atLocalMinute(slots[0] + 1));
    expect(sent()).toHaveBeenCalledTimes(2);

    sent().mockResolvedValue({ configured: true, sent: 1, removed: 0, failed: 0 });
    await processDueNotifications(atLocalMinute(slots[0] + 2));
    await processDueNotifications(atLocalMinute(slots[0] + 3));
    expect(sent()).toHaveBeenCalledTimes(3);
  });

  it("does not let two overlapping runs send the same reminder", async () => {
    await addOrder();
    await Promise.all([processDueNotifications(atLocalMinute(slots[2])), processDueNotifications(atLocalMinute(slots[2]))]);
    expect(sent()).toHaveBeenCalledTimes(1);
  });

  it("respects the owner's own awake hours", async () => {
    await addOrder();
    await db!.query("UPDATE notification_preferences SET awake_start = '12:00', awake_end = '20:00' WHERE user_id = $1", [alice.id]);
    await processDueNotifications(atLocalMinute(9 * 60));
    expect(sent()).not.toHaveBeenCalled();

    const mine = randomAlertSlots({ userId: alice.id, date: DATE, count: 3, startMinutes: 12 * 60, endMinutes: 20 * 60 });
    await processDueNotifications(atLocalMinute(mine[0]));
    expect(sent()).toHaveBeenCalledTimes(1);
  });
});
