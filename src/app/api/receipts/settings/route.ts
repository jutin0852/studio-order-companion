import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import { isStudioImageUrl } from "@/lib/image-url";
import { cleanAddress, cleanHandle, cleanPhone, DEFAULT_BRAND_COLOR, isHexColor } from "@/lib/receipts";

type SettingsRow = {
  business_name: string;
  profile_logo: string | null;
  logo_url: string | null;
  brand_color: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  x_handle: string | null;
  whatsapp: string | null;
};

function serialize(row: SettingsRow) {
  return {
    businessName: row.business_name,
    profileLogo: row.profile_logo,
    logo: row.logo_url,
    brandColor: row.brand_color ?? DEFAULT_BRAND_COLOR,
    address: row.address ?? "",
    phone: row.phone ?? "",
    instagram: row.instagram ?? "",
    tiktok: row.tiktok ?? "",
    facebook: row.facebook ?? "",
    x: row.x_handle ?? "",
    whatsapp: row.whatsapp ?? "",
  };
}

async function readSettings(businessId: string) {
  const result = await db!.query<SettingsRow>(
    `SELECT b.name AS business_name, b.logo_url AS profile_logo, rs.logo_url, rs.brand_color, rs.address, rs.phone,
            rs.instagram, rs.tiktok, rs.facebook, rs.x_handle, rs.whatsapp
     FROM businesses b
     LEFT JOIN receipt_settings rs ON rs.business_id = b.id
     WHERE b.id = $1`,
    [businessId],
  );
  return result.rows[0];
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to view receipt settings." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Receipt storage is not configured yet." }, { status: 503 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    return NextResponse.json({ settings: serialize(await readSettings(businessId)) });
  } catch {
    return NextResponse.json({ error: "Receipt settings could not be loaded right now." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to save receipt settings." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Receipt storage is not configured yet." }, { status: 503 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "There are no receipt settings to save." }, { status: 400 });

  const brandColor = body.brandColor === undefined ? DEFAULT_BRAND_COLOR : body.brandColor;
  const logo = body.logo === undefined || body.logo === null || body.logo === "" ? null : body.logo;
  const address = cleanAddress(body.address);
  const phone = cleanPhone(body.phone);
  const whatsapp = cleanPhone(body.whatsapp);
  const instagram = cleanHandle(body.instagram);
  const tiktok = cleanHandle(body.tiktok);
  const facebook = cleanHandle(body.facebook);
  const x = cleanHandle(body.x);

  if (!isHexColor(brandColor)) return NextResponse.json({ error: "Choose a valid brand colour." }, { status: 400 });
  if (logo !== null && !isStudioImageUrl(logo, process.env.CLOUDINARY_CLOUD_NAME)) return NextResponse.json({ error: "That receipt logo is not valid." }, { status: 400 });
  if (address === undefined) return NextResponse.json({ error: "The address must be 160 characters or fewer." }, { status: 400 });
  if (phone === undefined || whatsapp === undefined) return NextResponse.json({ error: "Enter phone numbers using digits, such as 0802 329 7930." }, { status: 400 });
  if (instagram === undefined || tiktok === undefined || facebook === undefined || x === undefined) {
    return NextResponse.json({ error: "Social handles can only use letters, numbers, dots, dashes and underscores." }, { status: 400 });
  }

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    await db.query(
      `INSERT INTO receipt_settings (business_id, logo_url, brand_color, address, phone, instagram, tiktok, facebook, x_handle, whatsapp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (business_id) DO UPDATE SET
         logo_url = EXCLUDED.logo_url, brand_color = EXCLUDED.brand_color, address = EXCLUDED.address,
         phone = EXCLUDED.phone, instagram = EXCLUDED.instagram, tiktok = EXCLUDED.tiktok,
         facebook = EXCLUDED.facebook, x_handle = EXCLUDED.x_handle, whatsapp = EXCLUDED.whatsapp,
         updated_at = now()`,
      [businessId, logo, brandColor.toUpperCase(), address, phone, instagram, tiktok, facebook, x, whatsapp],
    );
    return NextResponse.json({ settings: serialize(await readSettings(businessId)) });
  } catch {
    return NextResponse.json({ error: "Receipt settings could not be saved right now." }, { status: 503 });
  }
}
