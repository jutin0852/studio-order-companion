import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import { RECEIPT_HEIGHT, RECEIPT_WIDTH, receiptElement } from "@/lib/receipt-layout";
import { formatReceiptNumber } from "@/lib/receipts";
import { RECEIPT_COLUMNS, receiptData, type ReceiptRow } from "@/lib/receipts-db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_POLICIES } from "@/lib/rate-limit-policy";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to view receipts." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.render);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Receipt storage is not configured yet." }, { status: 503 });

  const receiptId = (await params).id;
  if (!uuidPattern.test(receiptId)) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query<ReceiptRow>(
      `SELECT ${RECEIPT_COLUMNS} FROM receipts WHERE id = $1::uuid AND business_id = $2`,
      [receiptId, businessId],
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

    const download = new URL(request.url).searchParams.get("download") === "1";
    return new ImageResponse(receiptElement(receiptData(row)), {
      width: RECEIPT_WIDTH,
      height: RECEIPT_HEIGHT,
      headers: {
        "Cache-Control": "private, no-store",
        ...(download ? { "Content-Disposition": `attachment; filename="receipt-${formatReceiptNumber(row.number)}.png"` } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "The receipt image could not be created right now." }, { status: 503 });
  }
}
