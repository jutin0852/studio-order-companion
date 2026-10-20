import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import { RECEIPT_COLUMNS, serializeReceipt, type ReceiptRow } from "@/lib/receipts-db";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Issued receipts are locked. Voiding keeps the number on record and marks the
// image VOID; the owner then issues a fresh receipt with the next number.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to void a receipt." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Receipt storage is not configured yet." }, { status: 503 });

  const receiptId = (await params).id;
  if (!uuidPattern.test(receiptId)) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query<ReceiptRow>(
      `UPDATE receipts SET voided_at = COALESCE(voided_at, now())
       WHERE id = $1::uuid AND business_id = $2
       RETURNING ${RECEIPT_COLUMNS}`,
      [receiptId, businessId],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
    return NextResponse.json({ receipt: serializeReceipt(result.rows[0]) });
  } catch {
    return NextResponse.json({ error: "The receipt could not be voided right now." }, { status: 503 });
  }
}
