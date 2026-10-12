import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";

type ProductRow = {
  id: string;
  name: string;
  price: string | number;
  image_url: string | null;
  archived: boolean;
};

function serializeProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    ...(row.image_url ? { image: row.image_url } : {}),
    archived: row.archived,
    color: "bg-plaster",
  };
}

function validImageUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 2_000 &&
    value.startsWith("https://")
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json(
      { error: "You must be signed in to update products." },
      { status: 401 },
    );
  if (!db)
    return NextResponse.json(
      { error: "Product storage is not configured yet." },
      { status: 503 },
    );

  const productId = (await params).id;
  if (!isUuid(productId))
    return NextResponse.json(
      { error: "That product was not found." },
      { status: 404 },
    );
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    price?: number;
    image?: string | null;
    archived?: boolean;
  } | null;
  const updates: string[] = [];
  const values: unknown[] = [];
  const addUpdate = (sql: string, value: unknown) => {
    values.push(value);
    updates.push(`${sql} = $${values.length + 2}`);
  };

  if (body?.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length > 160)
      return NextResponse.json(
        { error: "Enter a valid product name." },
        { status: 400 },
      );
    addUpdate("name", name);
  }
  if (body?.price !== undefined) {
    if (
      typeof body.price !== "number" ||
      !Number.isFinite(body.price) ||
      body.price <= 0
    )
      return NextResponse.json(
        { error: "Enter a valid product price." },
        { status: 400 },
      );
    addUpdate("price", body.price);
  }
  if (body?.image !== undefined) {
    if (body.image !== null && !validImageUrl(body.image))
      return NextResponse.json(
        { error: "That product image is not valid." },
        { status: 400 },
      );
    addUpdate("image_url", body.image);
  }
  if (body?.archived !== undefined) {
    if (typeof body.archived !== "boolean")
      return NextResponse.json(
        { error: "That archive state is not valid." },
        { status: 400 },
      );
    addUpdate("archived", body.archived);
  }
  if (!updates.length)
    return NextResponse.json(
      { error: "There are no product changes to save." },
      { status: 400 },
    );

  try {
    const businessId = await ensureUserWorkspace(
      session.user.id,
      session.user.name,
    );
    const result = await db.query<ProductRow>(
      `UPDATE products
       SET ${updates.join(", ")}, updated_at = now()
       WHERE id = $1::uuid AND business_id = $2
       RETURNING id, name, price, image_url, archived`,
      [productId, businessId, ...values],
    );
    if (!result.rowCount)
      return NextResponse.json(
        { error: "That product was not found." },
        { status: 404 },
      );
    return NextResponse.json({ product: serializeProduct(result.rows[0]) });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "A product with that name already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "The product could not be updated right now." },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json(
      { error: "You must be signed in to delete products." },
      { status: 401 },
    );
  if (!db)
    return NextResponse.json(
      { error: "Product storage is not configured yet." },
      { status: 503 },
    );

  const productId = (await params).id;
  if (!isUuid(productId))
    return NextResponse.json(
      { error: "That product was not found." },
      { status: 404 },
    );

  try {
    const businessId = await ensureUserWorkspace(
      session.user.id,
      session.user.name,
    );
    const result = await db.query(
      "DELETE FROM products WHERE id = $1::uuid AND business_id = $2 RETURNING id",
      [productId, businessId],
    );
    if (!result.rowCount)
      return NextResponse.json(
        { error: "That product was not found." },
        { status: 404 },
      );
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "The product could not be deleted right now." },
      { status: 503 },
    );
  }
}
