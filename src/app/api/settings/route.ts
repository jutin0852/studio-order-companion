import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be signed in to view settings." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Settings storage is not configured yet." }, { status: 503 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query("SELECT working_days, reminder_time::text AS reminder_time FROM business_settings WHERE business_id = $1", [businessId]);
    const row = result.rows[0];
    return NextResponse.json({ settings: { workingDays: Number(row?.working_days ?? 5), reminderTime: String(row?.reminder_time ?? "09:00").slice(0, 5) } });
  } catch {
    return NextResponse.json({ error: "Settings could not be loaded." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be signed in to update settings." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Settings storage is not configured yet." }, { status: 503 });
  const body = await request.json().catch(() => null) as { workingDays?: number; reminderTime?: string } | null;
  const workingDays = Number(body?.workingDays);
  const reminderTime = body?.reminderTime;
  if (!Number.isInteger(workingDays) || workingDays < 1 || workingDays > 31 || !reminderTime || !/^\d{2}:\d{2}$/.test(reminderTime)) return NextResponse.json({ error: "Choose valid business days and reminder time." }, { status: 400 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query(
      `UPDATE business_settings
       SET working_days = $2, reminder_time = $3::time, updated_at = now()
       WHERE business_id = $1
       RETURNING working_days, reminder_time::text AS reminder_time`,
      [businessId, workingDays, reminderTime],
    );
    await db.query("UPDATE notification_preferences SET reminder_time = $2::time, updated_at = now() WHERE user_id = $1", [session.user.id, reminderTime]);
    return NextResponse.json({ settings: { workingDays: Number(result.rows[0].working_days), reminderTime: String(result.rows[0].reminder_time).slice(0, 5) } });
  } catch {
    return NextResponse.json({ error: "Settings could not be saved." }, { status: 503 });
  }
}
