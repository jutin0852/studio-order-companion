import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCloudinarySignature, getCloudinaryConfig } from "@/lib/cloudinary";

const MAX_UPLOAD_BYTES = 900_000;
const allowedTypes = new Set(["image/webp", "image/jpeg", "image/png"]);
const allowedCategories = new Set(["products", "logos"]);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to upload an image." }, { status: 401 });

  const config = getCloudinaryConfig();
  if (!config) return NextResponse.json({ error: "Cloudinary image storage is not configured yet." }, { status: 503 });

  const body = await request.json().catch(() => null) as { category?: string; contentType?: string; size?: number } | null;
  const size = body?.size;
  if (!body?.category || !allowedCategories.has(body.category) || !body.contentType || !allowedTypes.has(body.contentType) || typeof size !== "number" || !Number.isInteger(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Upload an image compressed under 900 KB." }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `studio/users/${session.user.id}/${body.category}`;
  const signature = createCloudinarySignature({ folder, timestamp });

  return NextResponse.json({
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    signature,
    folder,
  });
}
