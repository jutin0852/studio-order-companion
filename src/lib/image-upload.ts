"use client";

const MAX_DIMENSION = 1600;
const MAX_BYTES = 900_000;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image could not be read. Try another file."));
    };
    image.src = objectUrl;
  });
}
function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("This image could not be compressed."));
    }, "image/webp", quality);
  });
}

export async function compressImage(file: File) {
  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, MAX_DIMENSION / longestSide);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const blob = await canvasBlob(canvas, quality);
    if (blob.size <= MAX_BYTES || quality === 0.52) return blob;
  }

  throw new Error("This image is too large after compression. Choose a smaller image.");
}

export async function uploadImage(file: File, category: "products" | "logos") {
  const compressed = await compressImage(file);
  const response = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, contentType: compressed.type, size: compressed.size }),
  });

  const payload = await response.json().catch(() => null) as { error?: string; cloudName?: string; apiKey?: string; timestamp?: number; signature?: string; folder?: string } | null;
  if (!response.ok || !payload?.cloudName || !payload.apiKey || !payload.timestamp || !payload.signature || !payload.folder) {
    throw new Error(payload?.error ?? "Image storage is not available yet.");
  }

  const formData = new FormData();
  formData.append("file", compressed, `studio-${category}-${Date.now()}.webp`);
  formData.append("api_key", payload.apiKey);
  formData.append("timestamp", String(payload.timestamp));
  formData.append("signature", payload.signature);
  formData.append("folder", payload.folder);

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${payload.cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const uploadPayload = await uploadResponse.json().catch(() => null) as { secure_url?: string; error?: { message?: string } } | null;
  if (!uploadResponse.ok || !uploadPayload?.secure_url) {
    throw new Error(uploadPayload?.error?.message ?? "The image upload failed. Try again.");
  }
  return uploadPayload.secure_url;
}
