import assert from "node:assert/strict";
import test from "node:test";
import { buildNudge, dueSlotIndex, isValidAwakeWindow, minutesFromTime, randomAlertSlots, rankOrdersForNudge, SLOT_GRACE_MINUTES } from "./random-alerts.ts";

const window = { startMinutes: 8 * 60, endMinutes: 21 * 60 };

test("slots are sorted, inside the awake window and spaced apart", () => {
  for (let day = 1; day <= 60; day += 1) {
    const slots = randomAlertSlots({ userId: "u1", date: `2026-11-${String(day % 28 + 1).padStart(2, "0")}`, count: 3, ...window });
    assert.equal(slots.length, 3);
    assert.deepEqual([...slots].sort((a, b) => a - b), slots);
    assert.ok(slots[0] >= window.startMinutes && slots[2] <= window.endMinutes);
    assert.ok(slots[1] - slots[0] >= 60 && slots[2] - slots[1] >= 60, `slots too close: ${slots}`);
  }
});

test("the same user and day always get the same slots, other days and users differ", () => {
  const a = randomAlertSlots({ userId: "u1", date: "2026-11-02", count: 3, ...window });
  assert.deepEqual(a, randomAlertSlots({ userId: "u1", date: "2026-11-02", count: 3, ...window }));
  assert.notDeepEqual(a, randomAlertSlots({ userId: "u1", date: "2026-11-03", count: 3, ...window }));
  assert.notDeepEqual(a, randomAlertSlots({ userId: "u2", date: "2026-11-02", count: 3, ...window }));
});

test("count is clamped between 1 and 5", () => {
  assert.equal(randomAlertSlots({ userId: "u", date: "2026-11-02", count: 0, ...window }).length, 1);
  assert.equal(randomAlertSlots({ userId: "u", date: "2026-11-02", count: 99, ...window }).length, 5);
});

test("a slot fires shortly after its time and not before or long after", () => {
  const slots = [600, 780, 960];
  assert.equal(dueSlotIndex(slots, 599), null);
  assert.equal(dueSlotIndex(slots, 600), 0);
  assert.equal(dueSlotIndex(slots, 600 + SLOT_GRACE_MINUTES), 0);
  assert.equal(dueSlotIndex(slots, 600 + SLOT_GRACE_MINUTES + 1), null);
  assert.equal(dueSlotIndex(slots, 790), 1);
  assert.equal(dueSlotIndex(slots, 1300), null);
});

test("time parsing and awake window validation", () => {
  assert.equal(minutesFromTime("08:30:00"), 510);
  assert.equal(minutesFromTime("25:00"), null);
  assert.equal(isValidAwakeWindow("08:00", "21:00"), true);
  assert.equal(isValidAwakeWindow("08:00", "10:00"), false);
  assert.equal(isValidAwakeWindow("21:00", "08:00"), false);
});

const order = (id, due, status = "in_progress", snoozed = null) => ({ order_id: id, customer_name: `C${id}`, product_name: `P${id}`, due_date: due, status, snoozed_until: snoozed });
const today = "2026-11-02";

test("orders are ranked overdue, due today, ready, due soon, then later", () => {
  const ranked = rankOrdersForNudge([order("a", "2026-11-20"), order("b", "2026-11-04"), order("c", "2026-11-02"), order("d", "2026-10-30"), order("e", "2026-11-10", "ready"), order("f", "2026-10-01", "delivered")], today);
  assert.deepEqual(ranked.map((item) => item.order.order_id), ["d", "c", "e", "b", "a"]);
});

test("a snooze hides future orders but not due or late ones", () => {
  const ranked = rankOrdersForNudge([order("a", "2026-11-05", "in_progress", "2026-11-04"), order("b", "2026-11-02", "in_progress", "2026-11-04"), order("c", "2026-10-30", "in_progress", "2026-11-04")], today);
  assert.deepEqual(ranked.map((item) => item.order.order_id), ["c", "b"]);
});

test("nudges rotate through orders and stay quiet when there is nothing to do", () => {
  const orders = [order("a", "2026-10-30"), order("b", "2026-11-02"), order("c", "2026-11-04")];
  assert.match(buildNudge(orders, today, 0).body, /Pa for Ca was due 3 days ago.*2 other orders also need a look/);
  assert.equal(buildNudge(orders, today, 1).title, "Due today");
  assert.equal(buildNudge(orders, today, 2).orderId, "c");
  assert.equal(buildNudge(orders, today, 3).orderId, "a");
  assert.equal(buildNudge([order("x", "2026-11-02", "delivered")], today, 0), null);
  assert.equal(buildNudge([], today, 0), null);
});
