import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import { FIELD_LIMITS, optionalText, requiredText } from "@/lib/field-limits";
import { sendPushToUser } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_POLICIES } from "@/lib/rate-limit-policy";

const statuses = new Set(["not_started", "in_progress", "ready", "delivered"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrderRow = {
  id: string;
  status: string;
  customer_name: string;
  product_name: string;
  product_id: string | null;
  amount_paid: string | number;
  due_date: string;
  notes: string | null;
  client_request_id: string | null;
  created_at: string | Date;
};

function serializeOrder(order: OrderRow) {
  return {
    id: order.id,
    customer: order.customer_name,
    product: order.product_name,
    productId: order.product_id,
    dueDate: order.due_date,
    total: Number(order.amount_paid),
    status: order.status,
    createdAt: order.created_at instanceof Date ? order.created_at.toISOString() : order.created_at,
    ...(order.notes ? { notes: order.notes } : {}),
    ...(order.client_request_id ? { clientRequestId: order.client_request_id } : {}),
    synced: true,
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to update orders." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.write);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Order storage is not configured yet." }, { status: 503 });

  const body = await request.json().catch(() => null) as {
    status?: string;
    customerName?: string;
    productName?: string;
    productId?: string | null;
    amountPaid?: number;
    dueDate?: string;
    notes?: string | null;
  } | null;
  if (!body || Object.keys(body).length === 0) return NextResponse.json({ error: "Add at least one order change." }, { status: 400 });
  if (body.status !== undefined && !statuses.has(body.status)) return NextResponse.json({ error: "That order status is not valid." }, { status: 400 });
  const customerName = body.customerName === undefined ? undefined : requiredText(body.customerName, FIELD_LIMITS.customerName);
  if (customerName === null) return NextResponse.json({ error: `Customer name is required and must be ${FIELD_LIMITS.customerName} characters or fewer.` }, { status: 400 });
  const productName = body.productName === undefined ? undefined : requiredText(body.productName, FIELD_LIMITS.productName);
  if (productName === null) return NextResponse.json({ error: `Product name is required and must be ${FIELD_LIMITS.productName} characters or fewer.` }, { status: 400 });
  const notes = body.notes === undefined ? undefined : optionalText(body.notes, FIELD_LIMITS.orderNotes);
  if (notes === null) return NextResponse.json({ error: `Notes must be ${FIELD_LIMITS.orderNotes} characters or fewer.` }, { status: 400 });
  if (body.amountPaid !== undefined && (!Number.isFinite(body.amountPaid) || body.amountPaid <= 0)) return NextResponse.json({ error: "Amount paid must be greater than zero." }, { status: 400 });
  if (body.dueDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) return NextResponse.json({ error: "Due date is not valid." }, { status: 400 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const orderId = (await params).id;
    if (!uuidPattern.test(orderId)) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const existingOrder = await db.query<{ status: string }>(
      "SELECT status FROM orders WHERE id = $1::uuid AND business_id = $2",
      [orderId, businessId],
    );
    if (!existingOrder.rowCount) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const previousStatus = existingOrder.rows[0].status;
    const values: unknown[] = [];
    const updates: string[] = [];
    const addUpdate = (column: string, value: unknown) => { values.push(value); updates.push(`${column} = $${values.length}`); };

    if (customerName !== undefined) addUpdate("customer_name", customerName);
    if (productName !== undefined) addUpdate("product_name", productName);
    if (body.amountPaid !== undefined) addUpdate("amount_paid", body.amountPaid);
    if (body.dueDate !== undefined) addUpdate("due_date", body.dueDate);
    if (notes !== undefined) addUpdate("notes", notes || null);
    if (body.productId !== undefined) {
      let productId: string | null = null;
      if (body.productId) {
        const product = await db.query("SELECT id FROM products WHERE id = $1::uuid AND business_id = $2", [body.productId, businessId]);
        if (!product.rowCount) return NextResponse.json({ error: "That product is not in your catalog." }, { status: 400 });
        productId = body.productId;
      }
      addUpdate("product_id", productId);
    }
    if (body.status !== undefined) {
      values.push(body.status);
      updates.push(`status = $${values.length}`, `completed_at = CASE WHEN $${values.length} = 'delivered' THEN COALESCE(completed_at, now()) ELSE NULL END`);
    }
    updates.push("updated_at = now()");
    values.push(orderId, businessId);

    const result = await db.query<OrderRow>(
      `UPDATE orders SET ${updates.join(", ")}
       WHERE id = $${values.length - 1}::uuid AND business_id = $${values.length}
       RETURNING id, status, customer_name, product_name, product_id, amount_paid, to_char(due_date, 'YYYY-MM-DD') AS due_date, notes, client_request_id, created_at`,
      values,
    );
    if (!result.rowCount) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const updatedOrder = result.rows[0];
    if (body.status && body.status !== previousStatus && (updatedOrder.status === "ready" || updatedOrder.status === "delivered")) {
      try {
        const preference = await db.query<{ push_enabled: boolean }>(
          "SELECT push_enabled FROM notification_preferences WHERE user_id = $1",
          [session.user.id],
        );
        if (preference.rows[0]?.push_enabled !== false) {
          await sendPushToUser(session.user.id, {
            title: updatedOrder.status === "ready" ? "Order ready to send" : "Order complete",
            body: updatedOrder.status === "ready" ? `${updatedOrder.product_name} for ${updatedOrder.customer_name} is ready for the next step.` : `${updatedOrder.product_name} for ${updatedOrder.customer_name} is marked delivered.`,
            url: `/orders?order=${updatedOrder.id}`,
            tag: `order-status-${updatedOrder.id}-${updatedOrder.status}`,
            kind: "order_status",
          });
        }
      } catch {
        // A notification delivery problem must not undo a successfully saved order update.
      }
    }
    return NextResponse.json({ order: serializeOrder(updatedOrder) });
  } catch {
    return NextResponse.json({ error: "The order could not be updated right now." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to delete orders." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.write);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Order storage is not configured yet." }, { status: 503 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const orderId = (await params).id;
    if (!uuidPattern.test(orderId)) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const result = await db.query("DELETE FROM orders WHERE id = $1::uuid AND business_id = $2 RETURNING id", [orderId, businessId]);
    if (!result.rowCount) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    return NextResponse.json({ deleted: true, id: orderId });
  } catch {
    return NextResponse.json({ error: "The order could not be deleted right now." }, { status: 503 });
  }
}
