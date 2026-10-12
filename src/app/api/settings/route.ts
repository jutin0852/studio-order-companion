import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";

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

type SettingsInput = {
  workingDays?: unknown;
  reminderTime?: unknown;
  timeZone?: unknown;
  attentionDaysBefore?: unknown;
  dueSoonDaysBefore?: unknown;
  overdueGraceDays?: unknown;
  overdueRepeatDays?: unknown;
  stalledRemindersEnabled?: unknown;
  stalledAfterDays?: unknown;
  stalledRepeatDays?: unknown;
};

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
}

function serialize(row: SettingsRow) {
  return {
    workingDays: Number(row.working_days),
    reminderTime: String(row.reminder_time).slice(0, 5),
    timeZone: String(row.timezone),
    attentionDaysBefore: Number(row.attention_days_before),
    dueSoonDaysBefore: row.due_soon_days_before.map(Number).sort((a, b) => b - a),
    overdueGraceDays: Number(row.overdue_grace_days),
    overdueRepeatDays: Number(row.overdue_repeat_days),
    stalledRemindersEnabled: row.stalled_reminders_enabled,
    stalledAfterDays: Number(row.stalled_after_days),
    stalledRepeatDays: Number(row.stalled_repeat_days),
  };
}

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be signed in to view settings." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Settings storage is not configured yet." }, { status: 503 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query<SettingsRow>(
      `SELECT working_days, reminder_time::text AS reminder_time, timezone,
              attention_days_before, due_soon_days_before,
              overdue_grace_days, overdue_repeat_days,
              stalled_reminders_enabled, stalled_after_days, stalled_repeat_days
       FROM business_settings WHERE business_id = $1`,
      [businessId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Settings row is missing.");
    return NextResponse.json({ settings: serialize(row) });
  } catch {
    return NextResponse.json({ error: "Settings could not be loaded." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be signed in to update settings." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Settings storage is not configured yet." }, { status: 503 });

  const body = await request.json().catch(() => null) as SettingsInput | null;
  const workingDays = Number(body?.workingDays);
  const reminderTime = typeof body?.reminderTime === "string" ? body.reminderTime : "";
  const timeZone = typeof body?.timeZone === "string" ? body.timeZone.trim() : "";
  const attentionDaysBefore = Number(body?.attentionDaysBefore);
  const dueSoonDaysBefore = body?.dueSoonDaysBefore;
  const overdueGraceDays = Number(body?.overdueGraceDays);
  const overdueRepeatDays = Number(body?.overdueRepeatDays);
  const stalledAfterDays = Number(body?.stalledAfterDays);
  const stalledRepeatDays = Number(body?.stalledRepeatDays);
  const [hours, minutes] = reminderTime.split(":").map(Number);
  const validDueSoonDays = Array.isArray(dueSoonDaysBefore)
    && dueSoonDaysBefore.length <= 10
    && dueSoonDaysBefore.every((day) => Number.isInteger(day) && Number(day) >= 1 && Number(day) <= 30)
    && new Set(dueSoonDaysBefore).size === dueSoonDaysBefore.length;

  if (
    !Number.isInteger(workingDays) || workingDays < 1 || workingDays > 31
    || !/^\d{2}:\d{2}$/.test(reminderTime) || !Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59
    || !isValidTimeZone(timeZone)
    || !Number.isInteger(attentionDaysBefore) || attentionDaysBefore < 1 || attentionDaysBefore > 30
    || !validDueSoonDays
    || !Number.isInteger(overdueGraceDays) || overdueGraceDays < 0 || overdueGraceDays > 14
    || !Number.isInteger(overdueRepeatDays) || overdueRepeatDays < 1 || overdueRepeatDays > 30
    || typeof body?.stalledRemindersEnabled !== "boolean"
    || !Number.isInteger(stalledAfterDays) || stalledAfterDays < 1 || stalledAfterDays > 30
    || !Number.isInteger(stalledRepeatDays) || stalledRepeatDays < 1 || stalledRepeatDays > 30
  ) {
    return NextResponse.json({ error: "Choose valid reminder timing and business settings." }, { status: 400 });
  }

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query<SettingsRow>(
      `WITH updated_settings AS (
         UPDATE business_settings
         SET working_days = $2,
             reminder_time = $3::time,
             timezone = $4,
             attention_days_before = $5,
             due_soon_days_before = $6::integer[],
             overdue_grace_days = $7,
             overdue_repeat_days = $8,
             stalled_reminders_enabled = $9,
             stalled_after_days = $10,
             stalled_repeat_days = $11,
             updated_at = now()
         WHERE business_id = $1
         RETURNING working_days, reminder_time::text AS reminder_time, timezone,
                   attention_days_before, due_soon_days_before,
                   overdue_grace_days, overdue_repeat_days,
                   stalled_reminders_enabled, stalled_after_days, stalled_repeat_days
       ), updated_preferences AS (
         UPDATE notification_preferences
         SET reminder_time = $3::time, updated_at = now()
         WHERE user_id = $12
       )
       SELECT * FROM updated_settings`,
      [
        businessId,
        workingDays,
        reminderTime,
        timeZone,
        attentionDaysBefore,
        dueSoonDaysBefore,
        overdueGraceDays,
        overdueRepeatDays,
        body.stalledRemindersEnabled,
        stalledAfterDays,
        stalledRepeatDays,
        session.user.id,
      ],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Settings could not be saved." }, { status: 503 });
    return NextResponse.json({ settings: serialize(result.rows[0]) });
  } catch {
    return NextResponse.json({ error: "Settings could not be saved." }, { status: 503 });
  }
}
