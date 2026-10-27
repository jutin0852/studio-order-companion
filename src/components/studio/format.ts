import type { Order } from "./types";

export const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function resolveDeviceTimeZone(fallback: string) {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return fallback;
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return fallback;
  }
}

export const fmt = (value: number) => money.format(value);

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function dayKey(date: string) {
  return date.slice(0, 10);
}

export function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}-01T00:00:00`));
}

export function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function dateHeading(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function shortDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function dueLabelForDate(value: string, today: string) {
  if (value === today) return "Today";
  if (value === addCalendarDays(today, 1)) return "Tomorrow";
  return shortDateLabel(value);
}

export function isOverdueDate(dueDate: string | undefined, today: string, graceDays: number) {
  if (!dueDate) return false;
  const daysLate = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) /
      86_400_000,
  );
  return daysLate > graceDays;
}

export function dueAttentionLabel(order: Order, today: string, graceDays: number) {
  if (!order.dueDate)
    return order.due === "Today" ? "Due today" : `Due ${order.due}`;
  const daysUntilDue = Math.round(
    (Date.parse(`${order.dueDate}T00:00:00Z`) -
      Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );
  if (daysUntilDue < 0 && -daysUntilDue > graceDays) return "Overdue";
  if (daysUntilDue < 0) {
    const daysLate = -daysUntilDue;
    return `Due ${daysLate} day${daysLate === 1 ? "" : "s"} ago`;
  }
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${daysUntilDue} days`;
}

export function addBusinessDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  let remaining = Math.max(1, days);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) remaining -= 1;
  }
  return dateKey(date);
}

export function dueOptionsFor(today: string, workingDays: number) {
  const base = Math.max(1, workingDays);
  return [base, base + 2, base + 5].map((offset) => {
    const value = addBusinessDays(today, offset);
    return { value, label: shortDateLabel(value) };
  });
}

export function initials(name?: string) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") ?? ""
  );
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
