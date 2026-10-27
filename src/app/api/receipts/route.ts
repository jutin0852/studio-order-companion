import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import { nairaInWords } from "@/lib/naira-words";
import { DEFAULT_BRAND_COLOR, isPaymentMethod, RECEIPT_LIMITS, type ReceiptBranding } from "@/lib/receipts";
import { RECEIPT_COLUMNS, serializeReceipt, type ReceiptRow } from "@/lib/receipts-db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_POLICIES } from "@/lib/rate-limit-policy";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 999_999_999.99;

function text(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to view receipts." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.read);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Receipt storage is not configured yet." }, { status: 503 });

  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId || !uuidPattern.test(orderId)) return NextResponse.json({ error: "Choose an order to list receipts for." }, { status: 400 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query<ReceiptRow>(
      `SELECT ${RECEIPT_COLUMNS} FROM receipts WHERE business_id = $1 AND order_id = $2::uuid ORDER BY number DESC`,
      [businessId, orderId],
    );
    return NextResponse.json({ receipts: result.rows.map(serializeReceipt) });
  } catch {
    return NextResponse.json({ error: "Receipts could not be loaded right now." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to create a receipt." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.write);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Receipt storage is not configured yet." }, { status: 503 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const receivedFrom = text(body?.receivedFrom, RECEIPT_LIMITS.receivedFrom);
  const paymentFor = text(body?.paymentFor, RECEIPT_LIMITS.paymentFor);
  const amount = body?.amount;
  const date = body?.date;
  const orderId = body?.orderId ?? null;

  if (!receivedFrom || !paymentFor) return NextResponse.json({ error: "Add who paid and what the payment is for." }, { status: 400 });
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return NextResponse.json({ error: "Enter an amount greater than zero." }, { status: 400 });
  }
  if (!isPaymentMethod(body?.paymentMethod)) return NextResponse.json({ error: "Choose how the customer paid." }, { status: 400 });
  if (typeof date !== "string" || !datePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return NextResponse.json({ error: "Choose a valid receipt date." }, { status: 400 });
  }
  if (orderId !== null && (typeof orderId !== "string" || !uuidPattern.test(orderId))) {
    return NextResponse.json({ error: "That order was not found." }, { status: 404 });
  }
  const roundedAmount = Math.round(amount * 100) / 100;
  nairaInWords(roundedAmount);

  const client = await db.connect();
  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    if (orderId) {
      const order = await client.query("SELECT 1 FROM orders WHERE id = $1::uuid AND business_id = $2", [orderId, businessId]);
      if (!order.rowCount) return NextResponse.json({ error: "That order was not found." }, { status: 404 });
    }

    await client.query("BEGIN");
    await client.query("INSERT INTO receipt_settings (business_id) VALUES ($1) ON CONFLICT (business_id) DO NOTHING", [businessId]);
    // Taking the number and bumping the counter in one statement keeps numbers
    // unique and gap-free even when two receipts are created at once.
    const counter = await client.query<{
      number: number; business_name: string; profile_logo: string | null; logo_url: string | null; brand_color: string;
      address: string | null; phone: string | null; instagram: string | null; tiktok: string | null;
      facebook: string | null; x_handle: string | null; whatsapp: string | null;
    }>(
      `WITH bumped AS (
         UPDATE receipt_settings SET next_number = next_number + 1
         WHERE business_id = $1
         RETURNING next_number - 1 AS number, logo_url, brand_color, address, phone, instagram, tiktok, facebook, x_handle, whatsapp
       )
       SELECT bumped.*, b.name AS business_name, b.logo_url AS profile_logo
       FROM bumped, businesses b WHERE b.id = $1`,
      [businessId],
    );
    const settings = counter.rows[0];
    const branding: ReceiptBranding = {
      name: settings.business_name,
      logo: settings.logo_url ?? settings.profile_logo,
      color: settings.brand_color || DEFAULT_BRAND_COLOR,
      address: settings.address,
      phone: settings.phone,
      instagram: settings.instagram,
      tiktok: settings.tiktok,
      facebook: settings.facebook,
      x: settings.x_handle,
      whatsapp: settings.whatsapp,
    };
    const inserted = await client.query<ReceiptRow>(
      `INSERT INTO receipts (business_id, order_id, number, received_from, amount, payment_for, payment_method, receipt_date, branding)
       VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::date, $9::jsonb)
       RETURNING ${RECEIPT_COLUMNS}`,
      [businessId, orderId, settings.number, receivedFrom, roundedAmount, paymentFor, body?.paymentMethod, date, JSON.stringify(branding)],
    );
    await client.query("COMMIT");
    return NextResponse.json({ receipt: serializeReceipt(inserted.rows[0]) }, { status: 201 });
  } catch {
    try { await client.query("ROLLBACK"); } catch { /* keep the original error */ }
    return NextResponse.json({ error: "The receipt could not be created right now." }, { status: 503 });
  } finally {
    client.release();
  }
}
