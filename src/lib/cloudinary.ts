import { createHash } from "node:crypto";

export function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function createCloudinarySignature(parameters: Record<string, string | number>) {
  const config = getCloudinaryConfig();
  if (!config) throw new Error("Cloudinary image storage is not configured.");

  const payload = Object.entries(parameters)
    .filter(([, value]) => value !== "" && value !== undefined && value !== null)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1").update(`${payload}${config.apiSecret}`).digest("hex");
}
