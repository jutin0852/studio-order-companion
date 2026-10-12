/** Parse a non-negative money value, allowing conventional comma grouping. */
export function parseMoneyInput(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const [whole, fraction, ...extra] = trimmed.split(".");
  const validWhole =
    /^\d+$/.test(whole) || /^\d{1,3}(?:,\d{3})+$/.test(whole);
  if (!validWhole || extra.length > 0 || (fraction !== undefined && !/^\d+$/.test(fraction))) {
    return null;
  }

  const amount = Number(trimmed.replaceAll(",", ""));
  return Number.isFinite(amount) ? amount : null;
}
