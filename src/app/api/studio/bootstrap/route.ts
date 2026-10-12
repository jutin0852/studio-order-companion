import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";

type OrderRow = {
  id: string;
  customer_name: string;
  product_name: string;
  product_id: string | null;
  amount_paid: string | number;
  due_date: string;
  status: string;
  notes: string | null;
  client_request_id: string | null;
  created_at: string | Date;
};

type ProductRow = {
  id: string;
  name: string;
  price: string | number;
  image_url: string | null;
  archived: boolean;
};

type ExpenseRow = { id: string; label: string; amount: string | number; occurred_on: string; notes: string | null };
type SettingsRow = {
  working_days: number;
  reminder_time: string;
  timezone: string;
  attention_days_before: number;
  due_soon_days_before: number[];
  overdue_grace_days: number;
  overdue_repeat_days: number;
  stalled_reminders_enabled: boolean;
  stalled_after_days: number;
  stalled_repeat_days: number;
};
type ProfileRow = { business_name: string; logo_url: string | null; owner_name: string };
type SnoozeRow = { order_id: string; snoozed_until: string };

function serializeOrder(row: OrderRow) {
  return {
    id: row.id,
    customer: row.customer_name,
    product: row.product_name,
    productId: row.product_id,
    dueDate: row.due_date,
    total: Number(row.amount_paid),
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.client_request_id ? { clientRequestId: row.client_request_id } : {}),
    synced: true,
  };
}

function serializeProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    ...(row.image_url ? { image: row.image_url } : {}),
    archived: row.archived,
    color: "bg-plaster",
  };
}

function serializeExpense(row: ExpenseRow) {
  return { id: row.id, label: row.label, amount: Number(row.amount), date: row.occurred_on, ...(row.notes ? { notes: row.notes } : {}) };
}

function serializeProfile(row: ProfileRow | undefined, fallbackName?: string | null) {
  if (!row) return { businessName: "My business", ownerName: fallbackName ?? "" };
  return { businessName: row.business_name, ownerName: row.owner_name, ...(row.logo_url ? { logo: row.logo_url } : {}) };
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to load Studio." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Studio storage is not configured yet." }, { status: 503 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const [orders, products, expenses, settings, profile, snoozed] = await Promise.all([
      db.query<OrderRow>(
        `SELECT id, customer_name, product_name, product_id, amount_paid, to_char(due_date, 'YYYY-MM-DD') AS due_date, status, notes, client_request_id, created_at
         FROM orders
         WHERE business_id = $1
         ORDER BY CASE WHEN status = 'delivered' THEN 1 ELSE 0 END, due_date ASC, created_at DESC`,
        [businessId],
      ),
      db.query<ProductRow>(
        `SELECT id, name, price, image_url, archived
         FROM products
         WHERE business_id = $1
         ORDER BY archived ASC, name ASC`,
        [businessId],
      ),
      db.query<ExpenseRow>(
        `SELECT id, label, amount, to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on, notes
         FROM expenses
         WHERE business_id = $1
         ORDER BY occurred_on DESC, created_at DESC`,
        [businessId],
      ),
      db.query<SettingsRow>(
        `SELECT working_days, reminder_time::text AS reminder_time, timezone,
                attention_days_before, due_soon_days_before,
                overdue_grace_days, overdue_repeat_days,
                stalled_reminders_enabled, stalled_after_days, stalled_repeat_days
         FROM business_settings
         WHERE business_id = $1`,
        [businessId],
      ),
      db.query<ProfileRow>(
        `SELECT b.name AS business_name, b.logo_url, u.name AS owner_name
         FROM businesses b
         JOIN "user" u ON u.id = b.owner_user_id
         WHERE b.id = $1 AND b.owner_user_id = $2`,
        [businessId, session.user.id],
      ),
      db.query<SnoozeRow>(
        `SELECT order_id, to_char(snoozed_until, 'YYYY-MM-DD') AS snoozed_until
         FROM order_snoozes
         WHERE business_id = $1 AND snoozed_until > current_date`,
        [businessId],
      ),
    ]);

    const settingsRow = settings.rows[0];
    return NextResponse.json({
      orders: orders.rows.map(serializeOrder),
      products: products.rows.map(serializeProduct),
      expenses: expenses.rows.map(serializeExpense),
      settings: {
        workingDays: Number(settingsRow?.working_days ?? 5),
        reminderTime: String(settingsRow?.reminder_time ?? "09:00").slice(0, 5),
        timeZone: String(settingsRow?.timezone ?? "Africa/Lagos"),
        attentionDaysBefore: Number(settingsRow?.attention_days_before ?? 3),
        dueSoonDaysBefore: (settingsRow?.due_soon_days_before ?? [3, 2]).map(Number),
        overdueGraceDays: Number(settingsRow?.overdue_grace_days ?? 0),
        overdueRepeatDays: Number(settingsRow?.overdue_repeat_days ?? 1),
        stalledRemindersEnabled: settingsRow?.stalled_reminders_enabled ?? false,
        stalledAfterDays: Number(settingsRow?.stalled_after_days ?? 2),
        stalledRepeatDays: Number(settingsRow?.stalled_repeat_days ?? 2),
      },
      profile: serializeProfile(profile.rows[0], session.user.name),
      snoozed: Object.fromEntries(snoozed.rows.map((row) => [row.order_id, row.snoozed_until])),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Studio data could not be loaded right now." }, { status: 503 });
  }
}
