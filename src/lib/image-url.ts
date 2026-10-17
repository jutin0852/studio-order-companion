const MAX_IMAGE_URL_LENGTH = 2_000;
const CLOUDINARY_HOST = "res.cloudinary.com";

// Only accepts images served from this app's Cloudinary account, which is the
// only place the upload route stores images. Without a configured cloud name
// the account path check is skipped but the host check still applies.
export function isStudioImageUrl(value: unknown, cloudName?: string | null): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_IMAGE_URL_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.hostname !== CLOUDINARY_HOST) return false;
  if (url.username || url.password || url.port) return false;
  if (cloudName && !url.pathname.startsWith(`/${cloudName}/image/upload/`)) return false;
  return true;
}
