import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { isDueSoonDay } from "@/lib/reminder-days";

type NotificationOrder = {
  order_id: string;
  user_id: string;
  customer_name: string;
  product_name: string;
  due_date: string;
  updated_date: string;
  status: string;
  push_enabled: boolean;
  due_today_enabled: boolean;
  due_soon_enabled: boolean;
  overdue_enabled: boolean;
  daily_digest_enabled: boolean;
  due_soon_days_before: number[];
  overdue_grace_days: number;
  overdue_repeat_days: number;
  stalled_reminders_enabled: boolean;
  stalled_after_days: number;
  stalled_repeat_days: number;
  reminder_time: string;
  timezone: string;
  snoozed_until: string | null;
};

function localDateKey(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localMinutes(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function validTimeZoneOrDefault(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "Africa/Lagos";
  }
}

function dateDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

type ReminderKind = "overdue" | "due_today" | "due_soon" | "stalled";

function reminderKind(order: NotificationOrder, today: string): ReminderKind | null {
  const daysUntilDue = dateDifference(today, order.due_date);
  if (daysUntilDue === 0 && order.due_today_enabled) return "due_today";

  const daysOverdue = -daysUntilDue;
  const overdueStartsAfter = Math.max(1, order.overdue_grace_days + 1);
  if (daysUntilDue < 0 && order.overdue_enabled && daysOverdue >= overdueStartsAfter) return "overdue";
  if (order.due_soon_enabled && isDueSoonDay(daysUntilDue, order.due_soon_days_before)) return "due_soon";

  const stalledDays = dateDifference(order.updated_date, today);
  if (
    order.stalled_reminders_enabled
    && (order.status === "not_started" || order.status === "in_progress")
    && stalledDays >= order.stalled_after_days
  ) return "stalled";
  return null;
}

function reminderCopy(kind: ReminderKind, order: NotificationOrder, today: string) {
  const url = `/orders?order=${encodeURIComponent(order.order_id)}`;
  if (kind === "overdue") return { title: "Overdue order needs action", body: `${order.product_name} for ${order.customer_name} is overdue. Open Studio and move it forward.`, url };
  if (kind === "due_today") return { title: "Due today: take the next step", body: `Finish ${order.product_name} for ${order.customer_name} today.`, url };
  if (kind === "stalled") return { title: "Order may need a nudge", body: `Take the next step on ${order.product_name} for ${order.customer_name}, or update its status.`, url };
  const daysUntilDue = dateDifference(today, order.due_date);
  return { title: `Due in ${daysUntilDue} days: prepare order`, body: `${order.product_name} for ${order.customer_name} needs your attention before its due date.`, url };
}

function reminderDedupeKey(kind: ReminderKind, order: NotificationOrder, today: string) {
  if (kind === "overdue") {
    const firstAlertDay = Math.max(1, order.overdue_grace_days + 1);
    const daysOverdue = -dateDifference(today, order.due_date);
    const repeatWindow = Math.floor((daysOverdue - firstAlertDay) / order.overdue_repeat_days);
    return `${order.order_id}:overdue:g${order.overdue_grace_days}:r${order.overdue_repeat_days}:${repeatWindow}`;
  }
  if (kind === "stalled") {
    const stalledDays = dateDifference(order.updated_date, today);
    const repeatWindow = Math.floor((stalledDays - order.stalled_after_days) / order.stalled_repeat_days);
    return `${order.order_id}:stalled:${order.updated_date}:r${order.stalled_repeat_days}:${repeatWindow}`;
  }
  return `${order.order_id}:${kind}:${today}`;
}

function dailyDigestCopy(orderCount: number, today: string) {
  return {
    title: "Your Studio daily summary",
    body: `${orderCount} order${orderCount === 1 ? "" : "s"} need${orderCount === 1 ? "s" : ""} your attention today.`,
    url: "/orders",
    tag: `daily_digest:${today}`,
    kind: "daily_digest" as const,
  };
}

type ReminderDelivery = {
  dedupeKey: string;
  orderId: string;
  userId: string;
  kind: ReminderKind | "daily_digest";
  payload: Parameters<typeof sendPushToUser>[1];
};

async function deliverReminder(reminderInput: ReminderDelivery) {
  if (!db) return { sent: 0, failed: 0, skipped: 1 };

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [reminderInput.dedupeKey]);
    const reminder = await client.query<{ id: string; status: string }>(
      `INSERT INTO reminders (business_id, order_id, kind, scheduled_for, dedupe_key)
       SELECT business_id, $1, $2, now(), $3 FROM orders WHERE id = $1
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE SET updated_at = now()
       RETURNING id, status`,
      [reminderInput.orderId, reminderInput.kind, reminderInput.dedupeKey],
    );

    if (!reminder.rows[0] || reminder.rows[0].status === "sent") {
      await client.query("COMMIT");
      return { sent: 0, failed: 0, skipped: 1 };
    }

    const delivery = await sendPushToUser(reminderInput.userId, reminderInput.payload);
    if (delivery.sent > 0) {
      await client.query("UPDATE reminders SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1", [reminder.rows[0].id]);
    }
    await client.query("COMMIT");
    return { sent: delivery.sent, failed: delivery.failed, skipped: delivery.sent === 0 && delivery.failed === 0 ? 1 : 0 };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original notification error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function processDueNotifications(now = new Date()) {
  if (!db) return { processed: 0, sent: 0, failed: 0, skipped: 0 };

  const result = await db.query<NotificationOrder>(
    `SELECT o.id AS order_id,
            b.owner_user_id AS user_id,
            o.customer_name,
            o.product_name,
            to_char(o.due_date, 'YYYY-MM-DD') AS due_date,
            to_char(o.updated_at AT TIME ZONE COALESCE(bs.timezone, 'Africa/Lagos'), 'YYYY-MM-DD') AS updated_date,
            o.status,
            COALESCE(np.push_enabled, true) AS push_enabled,
            COALESCE(np.due_today_enabled, true) AS due_today_enabled,
            COALESCE(np.due_soon_enabled, true) AS due_soon_enabled,
            COALESCE(np.overdue_enabled, true) AS overdue_enabled,
            COALESCE(np.daily_digest_enabled, false) AS daily_digest_enabled,
            COALESCE(bs.due_soon_days_before, ARRAY[3, 2]::integer[]) AS due_soon_days_before,
            COALESCE(bs.overdue_grace_days, 0) AS overdue_grace_days,
            COALESCE(bs.overdue_repeat_days, 1) AS overdue_repeat_days,
            COALESCE(bs.stalled_reminders_enabled, false) AS stalled_reminders_enabled,
            COALESCE(bs.stalled_after_days, 2) AS stalled_after_days,
            COALESCE(bs.stalled_repeat_days, 2) AS stalled_repeat_days,
            COALESCE(np.reminder_time, bs.reminder_time, '09:00')::text AS reminder_time,
            COALESCE(bs.timezone, 'Africa/Lagos') AS timezone,
            to_char(os.snoozed_until, 'YYYY-MM-DD') AS snoozed_until
     FROM orders o
     JOIN businesses b ON b.id = o.business_id
     LEFT JOIN notification_preferences np ON np.user_id = b.owner_user_id
     LEFT JOIN business_settings bs ON bs.business_id = b.id
     LEFT JOIN order_snoozes os ON os.order_id = o.id
     WHERE o.status <> 'delivered'`,
  );

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const digestCandidates = new Map<string, { userId: string; today: string; orderId: string; count: number }>();

  for (const order of result.rows) {
    if (!order.push_enabled) {
      skipped += 1;
      continue;
    }

    const timeZone = validTimeZoneOrDefault(order.timezone);
    const today = localDateKey(now, timeZone);
    const kind = reminderKind(order, today);
    if (!kind) {
      skipped += 1;
      continue;
    }
    const isDeadlineDayAlert = kind === "due_today" || kind === "overdue";
    if (order.snoozed_until && order.snoozed_until > today && !isDeadlineDayAlert) {
      skipped += 1;
      continue;
    }
    const reminderMinutes = Number(order.reminder_time.slice(0, 2)) * 60 + Number(order.reminder_time.slice(3, 5));
    if (localMinutes(now, timeZone) < reminderMinutes) {
      skipped += 1;
      continue;
    }

    if (order.daily_digest_enabled) {
      const key = `${order.user_id}:${today}`;
      const candidate = digestCandidates.get(key);
      digestCandidates.set(key, candidate ? { ...candidate, count: candidate.count + 1 } : { userId: order.user_id, today, orderId: order.order_id, count: 1 });
    }

    processed += 1;
    const dedupeKey = reminderDedupeKey(kind, order, today);
    const delivery = await deliverReminder({
      dedupeKey,
      orderId: order.order_id,
      userId: order.user_id,
      kind,
      payload: { ...reminderCopy(kind, order, today), kind, tag: dedupeKey },
    });
    sent += delivery.sent;
    failed += delivery.failed;
    skipped += delivery.skipped;
  }

  for (const candidate of digestCandidates.values()) {
    const dedupeKey = `daily_digest:${candidate.userId}:${candidate.today}`;
    const delivery = await deliverReminder({
      dedupeKey,
      orderId: candidate.orderId,
      userId: candidate.userId,
      kind: "daily_digest",
      payload: dailyDigestCopy(candidate.count, candidate.today),
    });
    sent += delivery.sent;
    failed += delivery.failed;
    skipped += delivery.skipped;
  }

  return { processed, sent, failed, skipped };
}
