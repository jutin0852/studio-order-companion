import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCloudinarySignature, getCloudinaryConfig } from "@/lib/cloudinary";
import { readBodyWithinLimit } from "@/lib/read-body-with-limit.mjs";

const MAX_UPLOAD_BYTES = 2_000_000;
const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 32_000;
const allowedTypes = new Set(["image/webp", "image/jpeg", "image/png"]);
const allowedCategories = new Set(["products", "logos"]);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to upload an image." }, { status: 401 });

  const config = getCloudinaryConfig();
  if (!config) return NextResponse.json({ error: "Cloudinary image storage is not configured yet." }, { status: 503 });

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    return NextResponse.json({ error: "Refresh Studio to use the secure image uploader." }, { status: 415 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = Number(contentLengthHeader);
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    return NextResponse.json({ error: "This image is too large after compression. Choose another photo." }, { status: 413 });
  }

  const boundedBody = await readBodyWithinLimit(request.body, MAX_MULTIPART_BYTES);
  if (boundedBody.tooLarge) {
    return NextResponse.json({ error: "This image is too large after compression. Choose another photo." }, { status: 413 });
  }
  if (!boundedBody.body) {
    return NextResponse.json({ error: "Studio could not read this image. Try again." }, { status: 400 });
  }

  const boundedRequest = new Request(request.url, {
    method: "POST",
    headers: { "content-type": request.headers.get("content-type") as string },
    body: boundedBody.body,
  });
  const formData = await boundedRequest.formData().catch(() => null);
  const categories = formData?.getAll("category");
  const files = formData?.getAll("file");
  const category = categories?.[0];
  const file = files?.[0];
  const hasOnlyExpectedFields = formData && [...formData.keys()].every((key) => key === "category" || key === "file");

  if (
    !formData || !hasOnlyExpectedFields || categories?.length !== 1 || files?.length !== 1 ||
    typeof category !== "string" || !allowedCategories.has(category) || !(file instanceof File) ||
    !allowedTypes.has(file.type) || file.size <= 0 || file.size > MAX_UPLOAD_BYTES
  ) {
    return NextResponse.json({ error: "Studio could not prepare a compact image. Try another photo." }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `studio/users/${session.user.id}/${category}`;
  const signature = createCloudinarySignature({ folder, timestamp });
  const cloudinaryForm = new FormData();
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.slice("image/".length);
  cloudinaryForm.append("file", file, `studio-${category}-${timestamp}.${extension}`);
  cloudinaryForm.append("api_key", config.apiKey);
  cloudinaryForm.append("timestamp", String(timestamp));
  cloudinaryForm.append("signature", signature);
  cloudinaryForm.append("folder", folder);

  try {
    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
      { method: "POST", body: cloudinaryForm, signal: AbortSignal.timeout(20_000), cache: "no-store" },
    );
    const upload = await cloudinaryResponse.json().catch(() => null) as { secure_url?: string } | null;
    const imageUrl = upload?.secure_url ? new URL(upload.secure_url) : null;
    if (!cloudinaryResponse.ok || !imageUrl || imageUrl.protocol !== "https:" || imageUrl.hostname !== "res.cloudinary.com") {
      console.error("[uploads] Cloudinary rejected an image upload", { status: cloudinaryResponse.status });
      return NextResponse.json({ error: "The image could not be uploaded. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ url: imageUrl.toString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("[uploads] Cloudinary upload request failed", { timedOut });
    return NextResponse.json(
      { error: timedOut ? "Image upload took too long. Please try again." : "The image could not be uploaded. Please try again." },
      { status: timedOut ? 504 : 502 },
    );
  }
}
