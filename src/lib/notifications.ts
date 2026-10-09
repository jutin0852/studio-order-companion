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
  reminder_time: string;
  timezone: string;
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
  if (kind === "overdue") return { title: "Overdue order needs action", body: `${order.product_name} for ${order.customer_name} is overdue. Open Studio and move it forward.`, url: "/orders" };
  if (kind === "due_today") return { title: "Due today: take the next step", body: `Finish ${order.product_name} for ${order.customer_name} today.`, url: "/orders" };
  return { title: "Upcoming order to prepare", body: `${order.product_name} for ${order.customer_name} is due soon.`, url: "/orders" };
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
            COALESCE(np.reminder_time, bs.reminder_time, '09:00')::text AS reminder_time,
            COALESCE(bs.timezone, 'Africa/Lagos') AS timezone
     FROM orders o
     JOIN businesses b ON b.id = o.business_id
     LEFT JOIN notification_preferences np ON np.user_id = b.owner_user_id
     LEFT JOIN business_settings bs ON bs.business_id = b.id
     WHERE o.status <> 'delivered'`,
  );

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const order of result.rows) {
    if (!order.push_enabled) {
      skipped += 1;
      continue;
    }

    const today = localDateKey(now, order.timezone);
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

    processed += 1;
    const dedupeKey = `${order.order_id}:${kind}:${today}`;
    const reminder = await db.query<{ id: string; status: string }>(
      `INSERT INTO reminders (business_id, order_id, kind, scheduled_for, dedupe_key)
       SELECT business_id, $1, $2, now(), $3 FROM orders WHERE id = $1
       ON CONFLICT (dedupe_key) DO UPDATE SET updated_at = now()
       RETURNING id, status`,
      [order.order_id, kind, dedupeKey],
    );
    if (reminder.rows[0]?.status === "sent") {
      skipped += 1;
      continue;
    }

    const delivery = await sendPushToUser(order.user_id, { ...reminderCopy(kind, order), kind, tag: dedupeKey });
    if (delivery.sent > 0) {
      await db.query("UPDATE reminders SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1", [reminder.rows[0].id]);
      sent += delivery.sent;
    } else if (delivery.failed > 0) {
      failed += delivery.failed;
    } else {
      skipped += 1;
    }
  }

  return { processed, sent, failed, skipped };
}
