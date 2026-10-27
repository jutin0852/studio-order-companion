import { createHash } from "node:crypto";

export const DEFAULT_AWAKE_START = "08:00";
export const DEFAULT_AWAKE_END = "21:00";
export const DEFAULT_ALERTS_PER_DAY = 3;
export const MAX_ALERTS_PER_DAY = 5;
// Shortest awake window that still leaves room for several spaced-out alerts.
export const MIN_AWAKE_MINUTES = 180;
// A slot is only honoured shortly after it passes, so a late or missed cron run
// never turns into a burst of "catch-up" alerts.
export const SLOT_GRACE_MINUTES = 45;

export function minutesFromTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[1]) <= 23 && Number(match[2]) <= 59 ? minutes : null;
}

export function isValidAwakeWindow(start: string, end: string) {
  const from = minutesFromTime(start);
  const to = minutesFromTime(end);
  return from !== null && to !== null && to - from >= MIN_AWAKE_MINUTES;
}

// Deterministic per user and day, so a stateless once-a-minute scheduler always
// agrees on today's alert times without storing them.
function randoms(seed: string, count: number) {
  const digest = createHash("sha256").update(seed).digest();
  return Array.from({ length: count }, (_, index) => digest.readUInt32BE(index * 4) / 0x1_0000_0000);
}

/**
 * Picks `count` minute-of-day alert times inside the awake window. The window is
 * split into equal parts with one alert at a random point in the middle of each,
 * so alerts feel random but never bunch up or land at the window's edges.
 */
export function randomAlertSlots({ userId, date, count, startMinutes, endMinutes }: {
  userId: string;
  date: string;
  count: number;
  startMinutes: number;
  endMinutes: number;
}) {
  const alerts = Math.max(1, Math.min(MAX_ALERTS_PER_DAY, Math.floor(count)));
  const part = (endMinutes - startMinutes) / alerts;
  return randoms(`random-alerts:${userId}:${date}`, alerts).map((value, index) => {
    const from = startMinutes + index * part + part * 0.15;
    return Math.floor(from + value * part * 0.7);
  });
}

/** The index of the slot that should fire right now, if any. */
export function dueSlotIndex(slots: number[], nowMinutes: number) {
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const age = nowMinutes - slots[index];
    if (age >= 0) return age <= SLOT_GRACE_MINUTES ? index : null;
  }
  return null;
}

export type NudgeOrder = {
  order_id: string;
  customer_name: string;
  product_name: string;
  due_date: string;
  status: string;
  snoozed_until: string | null;
};

function dayDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Orders worth a nudge today, most pressing first. */
export function rankOrdersForNudge(orders: NudgeOrder[], today: string) {
  const ranked: Array<{ order: NudgeOrder; rank: number; daysUntilDue: number }> = [];
  for (const order of orders) {
    if (order.status === "delivered") continue;
    const daysUntilDue = dayDifference(today, order.due_date);
    const snoozed = order.snoozed_until !== null && order.snoozed_until > today;
    // A snooze quiets everything except orders that are due or late.
    if (snoozed && daysUntilDue > 0) continue;
    let rank: number;
    if (daysUntilDue < 0) rank = 0;
    else if (daysUntilDue === 0) rank = 1;
    else if (order.status === "ready") rank = 2;
    else if (daysUntilDue <= 3) rank = 3;
    else rank = 4;
    ranked.push({ order, rank, daysUntilDue });
  }
  return ranked.sort((a, b) => a.rank - b.rank || a.daysUntilDue - b.daysUntilDue || a.order.order_id.localeCompare(b.order.order_id));
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Builds one nudge. Successive alerts in a day highlight different orders so the
 * three don't repeat each other.
 */
export function buildNudge(orders: NudgeOrder[], today: string, slotIndex: number) {
  const ranked = rankOrdersForNudge(orders, today);
  if (ranked.length === 0) return null;
  const { order, rank, daysUntilDue } = ranked[slotIndex % ranked.length];
  const item = `${order.product_name} for ${order.customer_name}`;
  const more = ranked.length > 1 ? ` ${plural(ranked.length - 1, "other order")} also need${ranked.length === 2 ? "s" : ""} a look.` : "";

  let title: string;
  let body: string;
  if (rank === 0) {
    title = "An order is running late";
    body = `${item} was due ${plural(-daysUntilDue, "day")} ago. Check in and move it forward.${more}`;
  } else if (rank === 1) {
    title = "Due today";
    body = `${item} is due today.${more}`;
  } else if (rank === 2) {
    title = "Ready to send";
    body = `${item} is ready. Let the customer know.${more}`;
  } else if (rank === 3) {
    title = `Due in ${plural(daysUntilDue, "day")}`;
    body = `${item} is coming up. Is it on track?${more}`;
  } else {
    title = "Quick check-in";
    body = `${item} is due in ${plural(daysUntilDue, "day")}. Anything you can move along today?${more}`;
  }
  return { title, body, orderId: order.order_id };
}
