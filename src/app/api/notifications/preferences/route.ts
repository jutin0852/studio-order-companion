import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import {
  DEFAULT_ALERTS_PER_DAY,
  DEFAULT_AWAKE_END,
  DEFAULT_AWAKE_START,
  isValidAwakeWindow,
  MAX_ALERTS_PER_DAY,
  MIN_AWAKE_MINUTES,
} from "@/lib/random-alerts";

type Preferences = {
  pushEnabled: boolean;
  dueTodayEnabled: boolean;
  dueSoonEnabled: boolean;
  overdueEnabled: boolean;
  dailyDigestEnabled: boolean;
  randomAlertsEnabled: boolean;
  randomAlertsPerDay: number;
  awakeStart: string;
  awakeEnd: string;
};

type PreferencesRow = {
  push_enabled: boolean;
  due_today_enabled: boolean;
  due_soon_enabled: boolean;
  overdue_enabled: boolean;
  daily_digest_enabled: boolean;
  random_alerts_enabled: boolean;
  random_alerts_per_day: number;
  awake_start: string;
  awake_end: string;
};

const COLUMNS = `push_enabled, due_today_enabled, due_soon_enabled, overdue_enabled, daily_digest_enabled,
  random_alerts_enabled, random_alerts_per_day, awake_start::text AS awake_start, awake_end::text AS awake_end`;

const defaults: Preferences = {
  pushEnabled: true,
  dueTodayEnabled: true,
  dueSoonEnabled: true,
  overdueEnabled: true,
  dailyDigestEnabled: false,
  randomAlertsEnabled: true,
  randomAlertsPerDay: DEFAULT_ALERTS_PER_DAY,
  awakeStart: DEFAULT_AWAKE_START,
  awakeEnd: DEFAULT_AWAKE_END,
};

function serialize(row: PreferencesRow): Preferences {
  return {
    pushEnabled: row.push_enabled,
    dueTodayEnabled: row.due_today_enabled,
    dueSoonEnabled: row.due_soon_enabled,
    overdueEnabled: row.overdue_enabled,
    dailyDigestEnabled: row.daily_digest_enabled,
    randomAlertsEnabled: row.random_alerts_enabled,
    randomAlertsPerDay: row.random_alerts_per_day,
    awakeStart: String(row.awake_start).slice(0, 5),
    awakeEnd: String(row.awake_end).slice(0, 5),
  };
}

async function getUser() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getUser();
  if (!session) return NextResponse.json({ error: "You must be signed in to view notification preferences." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Notification storage is not configured yet." }, { status: 503 });

  try {
    await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query<PreferencesRow>(`SELECT ${COLUMNS} FROM notification_preferences WHERE user_id = $1`, [session.user.id]);
    return NextResponse.json({ preferences: result.rows[0] ? serialize(result.rows[0]) : defaults });
  } catch {
    return NextResponse.json({ error: "Notification preferences could not be loaded." }, { status: 503 });
  }
}

const bool = (value: unknown) => (typeof value === "boolean" ? value : null);

export async function PATCH(request: Request) {
  const session = await getUser();
  if (!session) return NextResponse.json({ error: "You must be signed in to update notification preferences." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Notification storage is not configured yet." }, { status: 503 });
  const body = await request.json().catch(() => null) as Partial<Record<keyof Preferences, unknown>> | null;

  const perDay = body?.randomAlertsPerDay;
  if (perDay !== undefined && (typeof perDay !== "number" || !Number.isInteger(perDay) || perDay < 1 || perDay > MAX_ALERTS_PER_DAY)) {
    return NextResponse.json({ error: `Choose between 1 and ${MAX_ALERTS_PER_DAY} alerts a day.` }, { status: 400 });
  }
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const value of [body?.awakeStart, body?.awakeEnd]) {
    if (value !== undefined && (typeof value !== "string" || !timePattern.test(value))) {
      return NextResponse.json({ error: "Enter the awake hours as times, such as 08:00." }, { status: 400 });
    }
  }

  try {
    await ensureUserWorkspace(session.user.id, session.user.name);
    if (body?.awakeStart !== undefined || body?.awakeEnd !== undefined) {
      const current = await db.query<PreferencesRow>(`SELECT ${COLUMNS} FROM notification_preferences WHERE user_id = $1`, [session.user.id]);
      const start = (body.awakeStart as string | undefined) ?? String(current.rows[0]?.awake_start ?? DEFAULT_AWAKE_START).slice(0, 5);
      const end = (body.awakeEnd as string | undefined) ?? String(current.rows[0]?.awake_end ?? DEFAULT_AWAKE_END).slice(0, 5);
      if (!isValidAwakeWindow(start, end)) {
        return NextResponse.json({ error: `Your awake hours need to span at least ${MIN_AWAKE_MINUTES / 60} hours.` }, { status: 400 });
      }
    }

    const result = await db.query<PreferencesRow>(
      `UPDATE notification_preferences
       SET push_enabled = COALESCE($2, push_enabled),
           due_today_enabled = COALESCE($3, due_today_enabled),
           due_soon_enabled = COALESCE($4, due_soon_enabled),
           overdue_enabled = COALESCE($5, overdue_enabled),
           daily_digest_enabled = COALESCE($6, daily_digest_enabled),
           random_alerts_enabled = COALESCE($7, random_alerts_enabled),
           random_alerts_per_day = COALESCE($8, random_alerts_per_day),
           awake_start = COALESCE($9::time, awake_start),
           awake_end = COALESCE($10::time, awake_end),
           updated_at = now()
       WHERE user_id = $1
       RETURNING ${COLUMNS}`,
      [
        session.user.id,
        bool(body?.pushEnabled),
        bool(body?.dueTodayEnabled),
        bool(body?.dueSoonEnabled),
        bool(body?.overdueEnabled),
        bool(body?.dailyDigestEnabled),
        bool(body?.randomAlertsEnabled),
        perDay ?? null,
        (body?.awakeStart as string | undefined) ?? null,
        (body?.awakeEnd as string | undefined) ?? null,
      ],
    );
    return NextResponse.json({ preferences: serialize(result.rows[0]) });
  } catch {
    return NextResponse.json({ error: "Notification preferences could not be saved." }, { status: 503 });
  }
}
