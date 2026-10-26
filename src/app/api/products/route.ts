import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import { isStudioImageUrl } from "@/lib/image-url";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_POLICIES } from "@/lib/rate-limit-policy";

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
  return isStudioImageUrl(value, process.env.CLOUDINARY_CLOUD_NAME);
}

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be signed in to view products." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.read);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Product storage is not configured yet." }, { status: 503 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query<ProductRow>(
      `SELECT id, name, price, image_url, archived
       FROM products
       WHERE business_id = $1
       ORDER BY archived ASC, name ASC`,
      [businessId],
    );
    return NextResponse.json({ products: result.rows.map(serializeProduct) });
  } catch {
    return NextResponse.json({ error: "Products could not be loaded right now." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be signed in to create a product." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.write);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Product storage is not configured yet." }, { status: 503 });

  const body = await request.json().catch(() => null) as { name?: string; price?: number; image?: string | null; archived?: boolean } | null;
  const name = body?.name?.trim();
  const price = body?.price;
  if (!name || name.length > 160 || typeof price !== "number" || !Number.isFinite(price) || price <= 0 || (body?.image !== undefined && body.image !== null && !validImageUrl(body.image))) {
    return NextResponse.json({ error: "Add a valid product name and price, and choose a valid image." }, { status: 400 });
  }
  const image = body?.image ?? null;
  const archived = body?.archived ?? false;

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query<ProductRow>(
      `INSERT INTO products (business_id, name, price, lead_time_days, image_url, archived)
       SELECT $1, $2, $3, settings.working_days, $4, $5
       FROM business_settings settings
       WHERE settings.business_id = $1
       RETURNING id, name, price, image_url, archived`,
      [businessId, name, price, image, archived],
    );
    if (!result.rows[0]) throw new Error("Business settings are unavailable.");
    return NextResponse.json({ product: serializeProduct(result.rows[0]) }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "A product with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "The product could not be saved right now." }, { status: 503 });
  }
}
