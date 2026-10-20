import { createHash, timingSafeEqual } from "node:crypto";

// Compares secrets in constant time. Hashing first gives equal-length buffers,
// so neither the content nor the length of the expected secret leaks via timing.
export function secretEquals(supplied: string | null | undefined, expected: string | null | undefined) {
  if (typeof supplied !== "string" || typeof expected !== "string" || expected === "") return false;
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
