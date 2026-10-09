import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";

const statuses = new Set(["not_started", "in_progress", "ready", "delivered"]);

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

async function getBusinessId(userId: string, userName?: string | null) {
  return ensureUserWorkspace(userId, userName);
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to view orders." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Order storage is not configured yet." }, { status: 503 });

  try {
    const businessId = await getBusinessId(session.user.id, session.user.name);
    const result = await db.query<OrderRow>(
      `SELECT id, customer_name, product_name, product_id, amount_paid, to_char(due_date, 'YYYY-MM-DD') AS due_date, status, notes, client_request_id, created_at
       FROM orders
       WHERE business_id = $1
       ORDER BY CASE WHEN status = 'delivered' THEN 1 ELSE 0 END, due_date ASC, created_at DESC`,
      [businessId],
    );
    return NextResponse.json({ orders: result.rows.map(serializeOrder) });
  } catch {
    return NextResponse.json({ error: "Orders could not be loaded right now." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to add an order." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Order storage is not configured yet." }, { status: 503 });

  const body = await request.json().catch(() => null) as {
    customerName?: string;
    productName?: string;
    productId?: string | null;
    amountPaid?: number;
    dueDate?: string;
    notes?: string;
    clientRequestId?: string;
    status?: string;
  } | null;
  const customerName = body?.customerName?.trim();
  const productName = body?.productName?.trim();
  const amountPaid = body?.amountPaid;
  const dueDate = body?.dueDate;
  const clientRequestId = body?.clientRequestId?.trim();
  const status = body?.status ?? "not_started";

  if (!customerName || !productName || typeof amountPaid !== "number" || !Number.isFinite(amountPaid) || amountPaid <= 0 || !dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !statuses.has(status)) {
    return NextResponse.json({ error: "Add a customer, product, amount paid, and due date." }, { status: 400 });
  }

  try {
    const businessId = await getBusinessId(session.user.id, session.user.name);
    let productId: string | null = null;
    if (body?.productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.productId)) {
      const product = await db.query("SELECT id FROM products WHERE id = $1 AND business_id = $2", [body.productId, businessId]);
      if (product.rowCount) productId = body.productId;
    }
    const result = await db.query<OrderRow>(
      `INSERT INTO orders (business_id, product_id, product_name, customer_name, amount_paid, due_date, notes, client_request_id, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''), $9, CASE WHEN $9 = 'delivered' THEN now() ELSE NULL END)
       ON CONFLICT (business_id, client_request_id) DO UPDATE SET
         product_id = EXCLUDED.product_id,
         product_name = EXCLUDED.product_name,
         customer_name = EXCLUDED.customer_name,
         amount_paid = EXCLUDED.amount_paid,
         due_date = EXCLUDED.due_date,
         notes = EXCLUDED.notes,
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING id, customer_name, product_name, product_id, amount_paid, to_char(due_date, 'YYYY-MM-DD') AS due_date, status, notes, client_request_id, created_at`,
      [businessId, productId, productName, customerName, amountPaid, dueDate, body?.notes?.trim() ?? "", clientRequestId ?? "", status],
    );
    return NextResponse.json({ order: serializeOrder(result.rows[0]) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The order could not be saved right now." }, { status: 503 });
  }
}
