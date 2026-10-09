import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

const statuses = new Set(["not_started", "in_progress", "ready", "delivered"]);

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
  if (body.customerName !== undefined && !body.customerName.trim()) return NextResponse.json({ error: "Customer name cannot be empty." }, { status: 400 });
  if (body.productName !== undefined && !body.productName.trim()) return NextResponse.json({ error: "Product name cannot be empty." }, { status: 400 });
  if (body.amountPaid !== undefined && (!Number.isFinite(body.amountPaid) || body.amountPaid <= 0)) return NextResponse.json({ error: "Amount paid must be greater than zero." }, { status: 400 });
  if (body.dueDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) return NextResponse.json({ error: "Due date is not valid." }, { status: 400 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const orderId = (await params).id;
    const values: unknown[] = [];
    const updates: string[] = [];
    const addUpdate = (column: string, value: unknown) => { values.push(value); updates.push(`${column} = $${values.length}`); };

    if (body.customerName !== undefined) addUpdate("customer_name", body.customerName.trim());
    if (body.productName !== undefined) addUpdate("product_name", body.productName.trim());
    if (body.amountPaid !== undefined) addUpdate("amount_paid", body.amountPaid);
    if (body.dueDate !== undefined) addUpdate("due_date", body.dueDate);
    if (body.notes !== undefined) addUpdate("notes", body.notes?.trim() || null);
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
    if (body.status && (updatedOrder.status === "ready" || updatedOrder.status === "delivered")) {
      try {
        await sendPushToUser(session.user.id, {
          title: updatedOrder.status === "ready" ? "Order ready to send" : "Order complete",
          body: updatedOrder.status === "ready" ? `${updatedOrder.product_name} for ${updatedOrder.customer_name} is ready for the next step.` : `${updatedOrder.product_name} for ${updatedOrder.customer_name} is marked delivered.`,
          url: `/orders?order=${updatedOrder.id}`,
          tag: `order-status-${updatedOrder.id}-${updatedOrder.status}`,
          kind: "order_status",
        });
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
  if (!db) return NextResponse.json({ error: "Order storage is not configured yet." }, { status: 503 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const orderId = (await params).id;
    const result = await db.query("DELETE FROM orders WHERE id = $1::uuid AND business_id = $2 RETURNING id", [orderId, businessId]);
    if (!result.rowCount) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    return NextResponse.json({ deleted: true, id: orderId });
  } catch {
    return NextResponse.json({ error: "The order could not be deleted right now." }, { status: 503 });
  }
}
