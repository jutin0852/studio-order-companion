export const FIELD_LIMITS = {
  customerName: 160,
  productName: 160,
  orderNotes: 2_000,
} as const;

// Returns the trimmed value, or null when it is not a string, empty, or too long.
export function requiredText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

// Optional text: undefined/null/blank become "", too-long or non-string becomes null.
export function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : null;
}
