export const PAYMENT_METHODS = [
  { value: "transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "pos", label: "POS" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const RECEIPT_LIMITS = { receivedFrom: 160, paymentFor: 200, address: 160, phone: 30, handle: 60 } as const;
export const DEFAULT_BRAND_COLOR = "#B3273A";

export type ReceiptBranding = {
  name: string;
  logo: string | null;
  color: string;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  x: string | null;
  whatsapp: string | null;
};

export type ReceiptData = {
  number: number;
  date: string;
  receivedFrom: string;
  amount: number;
  amountWords: string;
  paymentFor: string;
  paymentMethod: PaymentMethod;
  voided: boolean;
  branding: ReceiptBranding;
};

export const formatReceiptNumber = (number: number) => String(number).padStart(7, "0");

export const paymentMethodLabel = (method: string) => PAYMENT_METHODS.find((item) => item.value === method)?.label ?? "Other";

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

// "@glad.style " -> "glad.style"; null for blank, undefined when invalid.
export function cleanHandle(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const handle = value.trim().replace(/^@+/, "");
  if (!handle) return null;
  return handle.length <= RECEIPT_LIMITS.handle && /^[A-Za-z0-9._-]+$/.test(handle) ? handle : undefined;
}

// Phone and WhatsApp numbers: digits with an optional leading + and common separators.
export function cleanPhone(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const phone = value.trim();
  if (!phone) return null;
  return phone.length <= RECEIPT_LIMITS.phone && /^\+?[0-9][0-9 ()-]{3,}$/.test(phone) ? phone : undefined;
}

export function cleanAddress(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const address = value.trim().replace(/\s+/g, " ");
  if (!address) return null;
  return address.length <= RECEIPT_LIMITS.address ? address : undefined;
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHODS.some((item) => item.value === value);
}

// Cloudinary serves uploads as WebP; the image renderer needs PNG or JPEG, so
// ask Cloudinary to convert on the fly.
export function logoForRender(url: string | null) {
  if (!url) return null;
  return url.includes("/image/upload/") ? url.replace("/image/upload/", "/image/upload/f_png,w_400/") : url;
}
