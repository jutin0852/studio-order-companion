import { beforeEach, describe, expect, it } from "vitest";
import { POST as processRoute } from "@/app/api/notifications/process/route";
import { db, ensureUserWorkspace } from "@/lib/db";
import { nextRunAt, SAFETY_CHECK_MINUTES, type NextRunRow } from "@/lib/next-run";
import { processDueNotifications } from "@/lib/notifications";
import { randomAlertSlots } from "@/lib/random-alerts";
import { localDateKey, localMinutes, nextDateKey, zonedTimeToDate } from "@/lib/schedule-time";
import { alice, readJson, signInAs } from "./helpers/session";

const MINUTE = 60_000;
const at = (iso: string) => new Date(iso);
const backstopFrom = (now: Date) => new Date(now.getTime() + SAFETY_CHECK_MINUTES * MINUTE).toISOString();

const row = (overrides: Partial<NextRunRow> = {}): NextRunRow => ({
  user_id: "user-1",
  push_enabled: true,
  random_alerts_enabled: false,
  random_alerts_per_day: 3,
  awake_start: "08:00",
  awake_end: "21:00",
  reminder_time: "09:00",
  timezone: "Africa/Lagos",
  ...overrides,
});

describe("time-zone helpers", () => {
  it("turns a local wall-clock time into the right instant", () => {
    // Lagos is UTC+1 all year.
    expect(zonedTimeToDate("2026-11-02", 9 * 60, "Africa/Lagos").toISOString()).toBe("2026-11-02T08:00:00.000Z");
    // India is UTC+5:30.
    expect(zonedTimeToDate("2026-11-02", 9 * 60, "Asia/Kolkata").toISOString()).toBe("2026-11-02T03:30:00.000Z");
    // New York is on standard time (UTC-5) from 1 Nov 2026 and on daylight time (UTC-4) before it.
    expect(zonedTimeToDate("2026-11-02", 9 * 60, "America/New_York").toISOString()).toBe("2026-11-02T14:00:00.000Z");
    expect(zonedTimeToDate("2026-10-20", 9 * 60, "America/New_York").toISOString()).toBe("2026-10-20T13:00:00.000Z");
  });

  it("round-trips with the local date and minutes", () => {
    for (const zone of ["Africa/Lagos", "Asia/Kolkata", "America/New_York", "Pacific/Auckland"]) {
      const instant = zonedTimeToDate("2026-11-02", 13 * 60 + 25, zone);
      expect(localDateKey(instant, zone)).toBe("2026-11-02");
      expect(localMinutes(instant, zone)).toBe(13 * 60 + 25);
    }
  });

  it("rolls the date over month and year ends", () => {
    expect(nextDateKey("2026-10-31")).toBe("2026-11-01");
    expect(nextDateKey("2026-12-31")).toBe("2027-01-01");
    expect(nextDateKey("2028-02-28")).toBe("2028-02-29");
  });
});

describe("nextRunAt", () => {
  it("with nobody to notify, sleeps until the daily backstop", () => {
    const now = at("2026-11-02T06:00:00Z");
    expect(nextRunAt([], now).toISOString()).toBe(backstopFrom(now));
  });

  it("goes straight to a reminder hours away, with no hourly wake-up", () => {
    const now = at("2026-11-02T02:00:00Z"); // 03:00 in Lagos, reminder at 09:00
    expect(nextRunAt([row()], now).toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("moves to tomorrow's reminder once today's has passed", () => {
    const now = at("2026-11-02T09:30:00Z"); // 10:30 in Lagos
    expect(nextRunAt([row()], now).toISOString()).toBe("2026-11-03T08:00:00.000Z");
  });

  it("uses each person's own time zone", () => {
    const now = at("2026-11-02T02:30:00Z"); // 08:00 in Kolkata, 03:30 in Lagos
    const next = nextRunAt([row({ user_id: "a", timezone: "Asia/Kolkata" })], now);
    expect(next.toISOString()).toBe("2026-11-02T03:30:00.000Z"); // 09:00 in Kolkata
  });

  it("stops at the next random check-in", () => {
    const now = at("2026-11-02T06:00:00Z"); // 07:00 in Lagos, before the awake window
    const slots = randomAlertSlots({ userId: "user-1", date: "2026-11-02", count: 3, startMinutes: 8 * 60, endMinutes: 21 * 60 });
    const firstSlot = zonedTimeToDate("2026-11-02", slots[0], "Africa/Lagos");
    expect(nextRunAt([row({ random_alerts_enabled: true, reminder_time: "23:00" })], now).toISOString()).toBe(firstSlot.toISOString());
  });

  it("picks tomorrow's first check-in after the last one today", () => {
    const now = at("2026-11-02T21:30:00Z"); // 22:30 in Lagos, after the awake window
    const slots = randomAlertSlots({ userId: "user-1", date: "2026-11-03", count: 3, startMinutes: 8 * 60, endMinutes: 21 * 60 });
    const firstSlot = zonedTimeToDate("2026-11-03", slots[0], "Africa/Lagos");
    const next = nextRunAt([row({ random_alerts_enabled: true })], now, { hasReminderOn: () => false });
    expect(next.toISOString()).toBe(firstSlot.toISOString());
  });

  it("ignores people with notifications off", () => {
    const now = at("2026-11-02T07:30:00Z");
    expect(nextRunAt([row({ push_enabled: false })], now).toISOString()).toBe(backstopFrom(now));
  });

  it("takes the earliest across several people", () => {
    const now = at("2026-11-02T07:00:00Z"); // 08:00 in Lagos
    const next = nextRunAt([row({ user_id: "a", reminder_time: "10:30" }), row({ user_id: "b", reminder_time: "08:20" })], now);
    expect(next.toISOString()).toBe("2026-11-02T07:20:00.000Z");
  });

  it("retries a failed delivery within five minutes", () => {
    const now = at("2026-11-02T06:00:00Z");
    expect(nextRunAt([row()], now, { retrySoon: true }).getTime() - now.getTime()).toBe(5 * MINUTE);
  });

  it("waits for a reminder nearly two days away rather than waking in between", () => {
    const now = at("2026-11-02T00:30:00Z"); // 01:30 in Lagos, nothing due today
    const next = nextRunAt([row()], now, { hasReminderOn: (_row, date) => date === "2026-11-03" });
    expect(next.toISOString()).toBe("2026-11-03T08:00:00.000Z");
  });

  it("is never sooner than a minute away, even when something is due right now", () => {
    const now = at("2026-11-02T07:59:50Z"); // ten seconds before the 09:00 Lagos reminder
    expect(nextRunAt([row()], now).getTime() - now.getTime()).toBe(MINUTE);
  });

  it("falls back to Lagos time for an unknown time zone", () => {
    const now = at("2026-11-02T07:30:00Z");
    expect(nextRunAt([row({ timezone: "Mars/Olympus" })], now).toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  describe("only days with a real reminder count", () => {
    const now = at("2026-11-02T06:00:00Z");

    it("skips today when only tomorrow has a reminder", () => {
      const next = nextRunAt([row()], now, { hasReminderOn: (_row, date) => date === "2026-11-03" });
      expect(next.toISOString()).toBe("2026-11-03T08:00:00.000Z");
    });

    it("does not wake at all when neither day has one", () => {
      expect(nextRunAt([row()], now, { hasReminderOn: () => false }).toISOString()).toBe(backstopFrom(now));
    });

    it("counts any of a person's orders, not only the first", () => {
      const quiet = row({ reminder_time: "09:00" });
      const due = row({ reminder_time: "09:00" });
      const next = nextRunAt([quiet, due], now, { hasReminderOn: (order) => order === due });
      expect(next.toISOString()).toBe("2026-11-02T08:00:00.000Z");
    });
  });
});

describe("the processor reports when to call next", () => {
  let businessId: string;

  const addOrder = (dueDate: string) => db!.query(
    `INSERT INTO orders (business_id, product_name, customer_name, amount_paid, due_date, status)
     VALUES ($1, 'Gown', 'Ada', 1000, $2::date, 'not_started')`,
    [businessId, dueDate],
  );

  beforeEach(async () => {
    await signInAs(alice);
    businessId = await ensureUserWorkspace(alice.id, alice.name);
    await db!.query("DELETE FROM orders WHERE business_id = $1", [businessId]);
    await db!.query("UPDATE notification_preferences SET random_alerts_enabled = false WHERE user_id = $1", [alice.id]);
  });

  it("sleeps until the backstop when no order has a reminder soon", async () => {
    const now = at("2026-11-02T06:00:00Z");
    await addOrder("2026-12-25");
    expect((await processDueNotifications(now)).nextRunAt).toBe(backstopFrom(now));
  });

  it("wakes at the reminder time on the day an order needs it", async () => {
    await addOrder("2026-11-03");
    expect((await processDueNotifications(at("2026-11-02T06:00:00Z"))).nextRunAt).toBe("2026-11-03T08:00:00.000Z");
  });

  it("the scheduler endpoint passes it through", async () => {
    process.env.CRON_SECRET = "next-run-secret";
    const response = await processRoute(new Request("http://localhost/api/notifications/process", { method: "POST", headers: { "x-cron-secret": "next-run-secret" } }));
    expect(response.status).toBe(200);
    const body = await readJson<{ nextRunAt: string }>(response);
    expect(Number.isFinite(Date.parse(body.nextRunAt))).toBe(true);
    expect(Date.parse(body.nextRunAt)).toBeGreaterThan(Date.now());
  });
});
