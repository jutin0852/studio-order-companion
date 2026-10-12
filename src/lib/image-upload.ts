"use client";

type ImageCategory = "products" | "logos";

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MIN_DIMENSION = 320;

const compressionPolicy: Record<ImageCategory, { maxDimension: number; targetBytes: number }> = {
  products: { maxDimension: 1280, targetBytes: 700_000 },
  logos: { maxDimension: 768, targetBytes: 350_000 },
};

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

function drawScaledImage(image: HTMLImageElement, longestSide: number, limit: number) {
  const scale = Math.min(1, limit / longestSide);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function compressImage(file: File, category: ImageCategory = "products") {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file to upload.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("Choose an image smaller than 25 MB.");
  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) throw new Error("This image could not be read. Try another file.");

  const { maxDimension, targetBytes } = compressionPolicy[category];
  let dimension = Math.min(maxDimension, longestSide);
  let smallestBlob: Blob | null = null;

  while (true) {
    const canvas = drawScaledImage(image, longestSide, dimension);
    for (const quality of [0.84, 0.76, 0.68, 0.6, 0.52, 0.44]) {
      const blob = await canvasBlob(canvas, quality);
      smallestBlob = blob;
      if (blob.size <= targetBytes) return blob;
    }

    if (dimension <= MIN_DIMENSION) break;
    dimension = Math.max(MIN_DIMENSION, Math.round(dimension * 0.72));
  }

  if (smallestBlob && smallestBlob.size <= 2_000_000) return smallestBlob;
  throw new Error("This image could not be made compact enough. Try another photo.");
}

function extensionFor(contentType: string) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

export async function uploadImage(file: File, category: ImageCategory) {
  const compressed = await compressImage(file, category);
  const formData = new FormData();
  formData.append("category", category);
  formData.append("file", compressed, `studio-${category}-${Date.now()}.${extensionFor(compressed.type)}`);

  const response = await fetch("/api/uploads/presign", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null) as { error?: string; url?: string } | null;
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error ?? "Image storage is not available yet.");
  }

  return payload.url;
}
