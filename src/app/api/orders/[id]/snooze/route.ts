import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to snooze orders." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Order storage is not configured yet." }, { status: 503 });

  const orderId = (await params).id;
  if (!uuidPattern.test(orderId)) return NextResponse.json({ error: "That order was not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { snoozedUntil?: string | null } | null;
  const snoozedUntil = body?.snoozedUntil;
  if (snoozedUntil !== null && (typeof snoozedUntil !== "string" || !datePattern.test(snoozedUntil))) {
    return NextResponse.json({ error: "Choose a valid snooze date." }, { status: 400 });
  }

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const order = await db.query("SELECT id FROM orders WHERE id = $1::uuid AND business_id = $2", [orderId, businessId]);
    if (!order.rowCount) return NextResponse.json({ error: "That order was not found." }, { status: 404 });

    if (snoozedUntil === null) {
      await db.query("DELETE FROM order_snoozes WHERE order_id = $1::uuid AND business_id = $2", [orderId, businessId]);
      return NextResponse.json({ snoozedUntil: null });
    }

    const result = await db.query<{ snoozed_until: string }>(
      `INSERT INTO order_snoozes (order_id, business_id, snoozed_until)
       VALUES ($1::uuid, $2, $3::date)
       ON CONFLICT (order_id) DO UPDATE SET
         snoozed_until = EXCLUDED.snoozed_until,
         updated_at = now()
       RETURNING to_char(snoozed_until, 'YYYY-MM-DD') AS snoozed_until`,
      [orderId, businessId, snoozedUntil],
    );
    return NextResponse.json({ snoozedUntil: result.rows[0]?.snoozed_until ?? snoozedUntil });
  } catch {
    return NextResponse.json({ error: "The reminder could not be updated right now." }, { status: 503 });
  }
}
