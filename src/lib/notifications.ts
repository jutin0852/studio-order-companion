import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

type NotificationOrder = {
  order_id: string;
  user_id: string;
  customer_name: string;
  product_name: string;
  due_date: string;
  status: string;
  push_enabled: boolean;
  due_today_enabled: boolean;
  due_soon_enabled: boolean;
  overdue_enabled: boolean;
  daily_digest_enabled: boolean;
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

function dateDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function reminderKind(order: NotificationOrder, today: string) {
  const daysUntilDue = dateDifference(today, order.due_date);
  if (daysUntilDue < 0 && order.overdue_enabled) return "overdue" as const;
  if (daysUntilDue === 0 && order.due_today_enabled) return "due_today" as const;
  if (daysUntilDue >= 1 && daysUntilDue <= 2 && order.due_soon_enabled) return "due_soon" as const;
  return null;
}

function reminderCopy(kind: NonNullable<ReturnType<typeof reminderKind>>, order: NotificationOrder) {
  const url = `/orders?order=${encodeURIComponent(order.order_id)}`;
  if (kind === "overdue") return { title: "Overdue order needs action", body: `${order.product_name} for ${order.customer_name} is overdue. Open Studio and move it forward.`, url };
  if (kind === "due_today") return { title: "Due today: take the next step", body: `Finish ${order.product_name} for ${order.customer_name} today.`, url };
  return { title: "Upcoming order to prepare", body: `${order.product_name} for ${order.customer_name} is due soon.`, url };
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
  kind: "due_soon" | "due_today" | "overdue" | "daily_digest";
  payload: Parameters<typeof sendPushToUser>[1];
};

async function deliverReminder(reminderInput: ReminderDelivery) {
  if (!db) return { sent: 0, failed: 0, skipped: 1 };

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // Serialize workers for this reminder key. The lock is transaction-scoped,
    // so a second scheduler run cannot send until the first one records sent.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [reminderInput.dedupeKey]);
    const reminder = await client.query<{ id: string; status: string }>(
      `INSERT INTO reminders (business_id, order_id, kind, scheduled_for, dedupe_key)
       SELECT business_id, $1, $2, now(), $3 FROM orders WHERE id = $1
       ON CONFLICT (dedupe_key) DO UPDATE SET updated_at = now()
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
            o.status,
            COALESCE(np.push_enabled, true) AS push_enabled,
            COALESCE(np.due_today_enabled, true) AS due_today_enabled,
            COALESCE(np.due_soon_enabled, true) AS due_soon_enabled,
            COALESCE(np.overdue_enabled, true) AS overdue_enabled,
            COALESCE(np.daily_digest_enabled, false) AS daily_digest_enabled,
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

    const today = localDateKey(now, order.timezone);
    if (order.snoozed_until && order.snoozed_until > today) {
      skipped += 1;
      continue;
    }
    const reminderMinutes = Number(order.reminder_time.slice(0, 2)) * 60 + Number(order.reminder_time.slice(3, 5));
    if (localMinutes(now, order.timezone) < reminderMinutes) {
      skipped += 1;
      continue;
    }

    const kind = reminderKind(order, today);
    if (!kind) {
      skipped += 1;
      continue;
    }

    if (order.daily_digest_enabled) {
      const key = `${order.user_id}:${today}`;
      const candidate = digestCandidates.get(key);
      digestCandidates.set(key, candidate ? { ...candidate, count: candidate.count + 1 } : { userId: order.user_id, today, orderId: order.order_id, count: 1 });
    }

    processed += 1;
    const dedupeKey = `${order.order_id}:${kind}:${today}`;
    const delivery = await deliverReminder({
      dedupeKey,
      orderId: order.order_id,
      userId: order.user_id,
      kind,
      payload: { ...reminderCopy(kind, order), kind, tag: dedupeKey },
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
