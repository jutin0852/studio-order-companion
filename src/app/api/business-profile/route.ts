import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import { isStudioImageUrl } from "@/lib/image-url";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_POLICIES } from "@/lib/rate-limit-policy";

type ProfileRow = { business_name: string; logo_url: string | null; owner_name: string };

function serializeProfile(row: ProfileRow) {
  return { businessName: row.business_name, ownerName: row.owner_name, ...(row.logo_url ? { logo: row.logo_url } : {}) };
}

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

async function readProfile(businessId: string, userId: string) {
  const result = await db!.query<ProfileRow>(
    `SELECT b.name AS business_name, b.logo_url, u.name AS owner_name
     FROM businesses b
     JOIN "user" u ON u.id = b.owner_user_id
     WHERE b.id = $1 AND b.owner_user_id = $2`,
    [businessId, userId],
  );
  return result.rows[0];
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be signed in to view your profile." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.read);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Profile storage is not configured yet." }, { status: 503 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const profile = await readProfile(businessId, session.user.id);
    return NextResponse.json({ profile: profile ? serializeProfile(profile) : { businessName: "My business", ownerName: session.user.name ?? "" } });
  } catch {
    return NextResponse.json({ error: "Your business profile could not be loaded right now." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be signed in to update your profile." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.write);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Profile storage is not configured yet." }, { status: 503 });

  const body = await request.json().catch(() => null) as { businessName?: string; ownerName?: string; logo?: string | null } | null;
  if (!body || (body.businessName === undefined && body.ownerName === undefined && body.logo === undefined)) {
    return NextResponse.json({ error: "There are no profile changes to save." }, { status: 400 });
  }
  const businessName = body.businessName?.trim();
  const ownerName = body.ownerName?.trim();
  if (businessName !== undefined && (!businessName || businessName.length > 160)) return NextResponse.json({ error: "Enter a valid business name." }, { status: 400 });
  if (ownerName !== undefined && ownerName.length > 120) return NextResponse.json({ error: "Your name is too long." }, { status: 400 });
  if (body.logo !== undefined && body.logo !== null && !isStudioImageUrl(body.logo, process.env.CLOUDINARY_CLOUD_NAME)) return NextResponse.json({ error: "That business image is not valid." }, { status: 400 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    // Keep both writes and the read-back in one database round trip. The
    // previous implementation sent two UPDATEs and then a separate SELECT,
    // which was especially noticeable when Neon had to wake up.
    const result = await db.query<ProfileRow>(
      `WITH updated_business AS (
         UPDATE businesses
         SET name = COALESCE($3, name),
             logo_url = CASE WHEN $4::boolean THEN $5 ELSE logo_url END,
             updated_at = now()
         WHERE id = $2 AND owner_user_id = $1
         RETURNING id
       ), updated_user AS (
         UPDATE "user"
         SET name = CASE WHEN $6::boolean THEN $7 ELSE name END
         WHERE id = $1
         RETURNING id
       )
       SELECT b.name AS business_name, b.logo_url, u.name AS owner_name
       FROM businesses b
       JOIN "user" u ON u.id = b.owner_user_id
       WHERE b.id = $2 AND b.owner_user_id = $1`,
      [
        session.user.id,
        businessId,
        businessName ?? null,
        body.logo !== undefined,
        body.logo ?? null,
        body.ownerName !== undefined,
        ownerName ?? null,
      ],
    );
    const profile = result.rows[0];
    if (!profile) return NextResponse.json({ error: "Your business profile could not be saved right now." }, { status: 503 });
    return NextResponse.json({ profile: serializeProfile(profile) });
  } catch {
    return NextResponse.json({ error: "Your business profile could not be saved right now." }, { status: 503 });
  }
}
