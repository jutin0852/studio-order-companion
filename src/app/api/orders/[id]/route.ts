import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

const statuses = new Set(["not_started", "in_progress", "ready", "delivered"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to update orders." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Order storage is not configured yet." }, { status: 503 });

  const body = await request.json().catch(() => null) as { status?: string } | null;
  if (!body?.status || !statuses.has(body.status)) return NextResponse.json({ error: "That order status is not valid." }, { status: 400 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const orderId = (await params).id;
    const result = await db.query<{ id: string; status: string; customer_name: string; product_name: string }>(
      `UPDATE orders
       SET status = $1,
           completed_at = CASE WHEN $1 = 'delivered' THEN COALESCE(completed_at, now()) ELSE NULL END,
           updated_at = now()
       WHERE id = $2::uuid AND business_id = $3
       RETURNING id, status, customer_name, product_name`,
      [body.status, orderId, businessId],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const updatedOrder = result.rows[0];
    if (updatedOrder.status === "ready" || updatedOrder.status === "delivered") {
      try {
        await sendPushToUser(session.user.id, {
          title: updatedOrder.status === "ready" ? "Order ready to send" : "Order complete",
          body: updatedOrder.status === "ready" ? `${updatedOrder.product_name} for ${updatedOrder.customer_name} is ready for the next step.` : `${updatedOrder.product_name} for ${updatedOrder.customer_name} is marked delivered.`,
          url: "/orders",
          tag: `order-status-${updatedOrder.id}-${updatedOrder.status}`,
          kind: "order_status",
        });
      } catch {
        // A notification delivery problem must not undo a successfully saved order status.
      }
    }
    return NextResponse.json({ order: updatedOrder });
  } catch {
    return NextResponse.json({ error: "The order status could not be updated right now." }, { status: 503 });
  }
}
