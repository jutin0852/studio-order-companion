import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";

type Preferences = {
  pushEnabled: boolean;
  dueTodayEnabled: boolean;
  dueSoonEnabled: boolean;
  overdueEnabled: boolean;
  dailyDigestEnabled: boolean;
};

function serialize(row: { push_enabled: boolean; due_today_enabled: boolean; due_soon_enabled: boolean; overdue_enabled: boolean; daily_digest_enabled: boolean }): Preferences {
  return {
    pushEnabled: row.push_enabled,
    dueTodayEnabled: row.due_today_enabled,
    dueSoonEnabled: row.due_soon_enabled,
    overdueEnabled: row.overdue_enabled,
    dailyDigestEnabled: row.daily_digest_enabled,
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
    const result = await db.query("SELECT push_enabled, due_today_enabled, due_soon_enabled, overdue_enabled, daily_digest_enabled FROM notification_preferences WHERE user_id = $1", [session.user.id]);
    return NextResponse.json({ preferences: result.rows[0] ? serialize(result.rows[0]) : { pushEnabled: true, dueTodayEnabled: true, dueSoonEnabled: true, overdueEnabled: true, dailyDigestEnabled: false } });
  } catch {
    return NextResponse.json({ error: "Notification preferences could not be loaded." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const session = await getUser();
  if (!session) return NextResponse.json({ error: "You must be signed in to update notification preferences." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Notification storage is not configured yet." }, { status: 503 });
  const body = await request.json().catch(() => null) as Partial<Preferences> | null;

  try {
    await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query(
      `UPDATE notification_preferences
       SET push_enabled = COALESCE($2, push_enabled),
           due_today_enabled = COALESCE($3, due_today_enabled),
           due_soon_enabled = COALESCE($4, due_soon_enabled),
           overdue_enabled = COALESCE($5, overdue_enabled),
           daily_digest_enabled = COALESCE($6, daily_digest_enabled),
           updated_at = now()
       WHERE user_id = $1
       RETURNING push_enabled, due_today_enabled, due_soon_enabled, overdue_enabled, daily_digest_enabled`,
      [session.user.id, typeof body?.pushEnabled === "boolean" ? body.pushEnabled : null, typeof body?.dueTodayEnabled === "boolean" ? body.dueTodayEnabled : null, typeof body?.dueSoonEnabled === "boolean" ? body.dueSoonEnabled : null, typeof body?.overdueEnabled === "boolean" ? body.overdueEnabled : null, typeof body?.dailyDigestEnabled === "boolean" ? body.dailyDigestEnabled : null],
    );
    return NextResponse.json({ preferences: serialize(result.rows[0]) });
  } catch {
    return NextResponse.json({ error: "Notification preferences could not be saved." }, { status: 503 });
  }
}
