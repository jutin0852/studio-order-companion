"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Filter,
  Home as HomeIcon,
  Image as ImageIcon,
  Package,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PushNotificationSettings } from "@/components/studio/push-notification-settings";
import { ReceiptDialog } from "@/components/studio/receipt-dialog";
import { ReceiptSettingsPanel } from "@/components/studio/receipt-settings";
import { uploadImage } from "@/lib/image-upload";
import { parseMoneyInput } from "@/lib/money";

type Status = "not_started" | "in_progress" | "ready" | "delivered";
type View =
  | "today"
  | "orders"
  | "add"
  | "products"
  | "new_product"
  | "profile"
  | "summary"
  | "summary_orders"
  | "settings";
type Product = {
  id: string;
  name: string;
  price: number;
  color: string;
  image?: string;
  archived?: boolean;
};
type Order = {
  id: string;
  customer: string;
  product: string;
  productId?: string | null;
  due: string;
  dueDate?: string;
  total: number;
  status: Status;
  createdAt: string;
  notes?: string;
  clientRequestId?: string;
  synced?: boolean;
};
type Message = { type: "success" | "error"; text: string };
type ActionFeedback = { id: number; type: "success" | "error"; text: string };
type Expense = { id: string; label: string; amount: number; date: string };
type BusinessProfile = {
  logo?: string;
  ownerName?: string;
  businessName?: string;
};
type Settings = {
  workingDays: number;
  reminderTime: string;
  timeZone: string;
  attentionDaysBefore: number;
  dueSoonDaysBefore: number[];
  overdueGraceDays: number;
  overdueRepeatDays: number;
  stalledRemindersEnabled: boolean;
  stalledAfterDays: number;
  stalledRepeatDays: number;
};
const defaultSettings: Settings = {
  workingDays: 5,
  reminderTime: "09:00",
  timeZone: "Africa/Lagos",
  attentionDaysBefore: 3,
  dueSoonDaysBefore: [3, 2],
  overdueGraceDays: 0,
  overdueRepeatDays: 1,
  stalledRemindersEnabled: false,
  stalledAfterDays: 2,
  stalledRepeatDays: 2,
};
type StoredStudioState = {
  orders?: Order[];
  products?: Product[];
  expenses?: Expense[];
  settings?: Settings;
  snoozed?: Record<string, string> | string[];
  businessProfile?: Pick<
    BusinessProfile,
    "ownerName" | "logo" | "businessName"
  >;
};
type BootstrapPayload = {
  orders?: Array<Order & { dueDate?: string }>;
  products?: Product[];
  expenses?: Expense[];
  settings?: Settings;
  profile?: BusinessProfile;
  snoozed?: Record<string, string>;
};
const legacyDemoProductIds = new Set(["p1", "p2", "p3", "p4"]);
const legacyDemoOrderIds = new Set(["O-1048", "O-1047", "O-1043", "O-1039"]);
const legacyDemoExpenseIds = new Set(["e1"]);

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});
function resolveDeviceTimeZone(fallback: string) {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return fallback;
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return fallback;
  }
}
const fmt = (value: number) => money.format(value);
function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function monthKey(date: string) {
  return date.slice(0, 7);
}
function dayKey(date: string) {
  return date.slice(0, 10);
}
function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}-01T00:00:00`));
}
function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
function dateHeading(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
function shortDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
function dueLabelForDate(value: string, today: string) {
  if (value === today) return "Today";
  if (value === addCalendarDays(today, 1)) return "Tomorrow";
  return shortDateLabel(value);
}
function isOverdueDate(dueDate: string | undefined, today: string, graceDays: number) {
  if (!dueDate) return false;
  const daysLate = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) /
      86_400_000,
  );
  return daysLate > graceDays;
}
function dueAttentionLabel(order: Order, today: string, graceDays: number) {
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
function addBusinessDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  let remaining = Math.max(1, days);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) remaining -= 1;
  }
  return dateKey(date);
}
function dueOptionsFor(today: string, workingDays: number) {
  const base = Math.max(1, workingDays);
  return [base, base + 2, base + 5].map((offset) => {
    const value = addBusinessDays(today, offset);
    return { value, label: shortDateLabel(value) };
  });
}
function initials(name?: string) {
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
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
async function fetchJsonWithTimeout(
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
const statusLabel: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready: "Ready",
  delivered: "Delivered",
};
const statusStyle: Record<Status, string> = {
  not_started: "status-not-started",
  in_progress: "status-in-progress",
  ready: "status-complete",
  delivered: "status-complete",
};
const nextActionLabel: Partial<Record<Status, string>> = {
  not_started: "Start order",
  in_progress: "Mark ready",
  ready: "Mark delivered",
};
const navItems: { id: View; label: string; icon: typeof HomeIcon }[] = [
  { id: "today", label: "Today", icon: HomeIcon },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "add", label: "Add order", icon: Plus },
  { id: "products", label: "Products", icon: Package },
  { id: "profile", label: "Profile", icon: UserRound },
];
const storageKeyPrefix = "studio-state-v1";
const viewPaths: Record<View, string> = {
  today: "/",
  orders: "/orders",
  add: "/orders/new",
  products: "/products",
  new_product: "/products/new",
  profile: "/profile",
  summary: "/summary",
  summary_orders: "/summary/orders",
  settings: "/settings",
};
function viewForPathname(pathname: string | null): View {
  if (pathname?.startsWith("/products/") && pathname.endsWith("/edit"))
    return "new_product";
  switch (pathname) {
    case "/orders":
      return "orders";
    case "/orders/new":
      return "add";
    case "/products":
      return "products";
    case "/products/new":
      return "new_product";
    case "/profile/edit":
    case "/profile":
      return "profile";
    case "/summary/orders":
      return "summary_orders";
    case "/summary":
      return "summary";
    case "/settings":
      return "settings";
    default:
      return "today";
  }
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <UiBadge
      variant="secondary"
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[status]}`}
    >
      {statusLabel[status]}
    </UiBadge>
  );
}
function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  const showEyebrow = Boolean(eyebrow?.includes(","));
  return (
    <div className="surface-transition mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        {showEyebrow && (
          <p className="mb-1 text-sm font-semibold tracking-wide text-stone-500">
            {eyebrow}
          </p>
        )}
        <h1
          data-page-heading
          tabIndex={-1}
          className="surface-heading text-2xl font-bold tracking-tight text-stone-950 outline-none sm:text-3xl"
        >
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  tone,
  compact = false,
  valueClassName = "",
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
  compact?: boolean;
  valueClassName?: string;
}) {
  if (compact)
    return (
      <div className={`min-w-0 ${tone}`}>
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-current/50"
            aria-hidden="true"
          />
          <p className="truncate text-xs font-semibold text-stone-600">
            {label}
          </p>
        </div>
        <p
          className={`${valueClassName} mt-2 text-2xl font-bold leading-8 tracking-tight text-stone-950 sm:text-3xl`}
        >
          {value}
        </p>
        <p className="mt-1 hidden truncate text-xs font-medium text-stone-500 sm:block">
          {detail}
        </p>
      </div>
    );
  return (
    <Card className={`${tone} min-w-0 border-none ring-0`}>
      <CardContent className="min-w-0 p-3 sm:p-4">
        <p className="truncate text-[11px] font-semibold text-stone-600 sm:text-xs">
          {label}
        </p>
        <p
          className={`${valueClassName} mt-2 text-2xl font-bold tracking-tight sm:mt-3 sm:text-3xl`}
        >
          {value}
        </p>
        <p className="mt-1 truncate text-[11px] font-medium text-stone-600 sm:text-xs">
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}
function OrderRow({
  order,
  today,
  overdueGraceDays = 0,
  advance,
  onSelect,
}: {
  order: Order;
  today?: string;
  overdueGraceDays?: number;
  advance: (id: string) => void;
  onSelect?: (order: Order) => void;
}) {
  const overdue = Boolean(today && isOverdueDate(order.dueDate, today, overdueGraceDays));
  return (
    <article className="flex items-center gap-2 border-b border-stone-100 last:border-0">
      <Button
        variant="ghost"
        onClick={() => onSelect?.(order)}
        aria-label={`View order for ${order.customer}`}
        className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-xl px-2 py-3.5 text-left hover:bg-mist"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-plaster text-sm font-bold text-stone-600">
          {order.customer[0]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold">
              {order.customer}
            </span>
            <span
              className={`shrink-0 text-xs ${overdue ? "font-semibold text-rose-700" : order.due === "Today" ? "font-semibold text-amber-800" : "text-stone-500"}`}
            >
              {overdue ? "Overdue" : order.due}
            </span>
          </span>
          <span className="mt-1 block truncate text-xs text-stone-500">
            {order.product} · {fmt(order.total)}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            {order.synced === false && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                Waiting to sync
              </span>
            )}
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-stone-500"
          aria-hidden="true"
        />
      </Button>
      {order.status !== "delivered" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => advance(order.id)}
          className="hidden sm:inline-flex"
        >
          {nextActionLabel[order.status]}
        </Button>
      )}
    </article>
  );
}

function SummaryOrderRow({
  order,
  onSelect,
  showDate = false,
}: {
  order: Order;
  onSelect: (order: Order) => void;
  showDate?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelect(order)}
      aria-label={`Open order for ${order.customer}: ${order.product}, ${statusLabel[order.status]}, ${fmt(order.total)}`}
      className="h-auto w-full justify-start gap-3 rounded-none px-3 py-2.5 text-left hover:bg-mist focus-visible:z-10"
    >
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold text-stone-900">
            {order.customer}
          </span>
          <span className="shrink-0 text-xs text-stone-400">·</span>
          <span className="truncate text-xs text-stone-600">
            {order.product}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-stone-500">
          {showDate ? `${dayLabel(dayKey(order.createdAt))} · ` : ""}
          {statusLabel[order.status]}
          {order.synced === false ? " · Waiting to sync" : ""}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900">
        {fmt(order.total)}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
    </Button>
  );
}

function BusinessSummary({
  today,
  orders,
  expenses,
  selectedMonth,
  onSelectMonth,
  onBack,
  onAddOrder,
  onViewOrders,
  selectOrder,
}: {
  today: string;
  orders: Order[];
  expenses: Expense[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onBack: () => void;
  onAddOrder: () => void;
  onViewOrders: (month: string) => void;
  selectOrder: (order: Order) => void;
}) {
  const currentMonth = monthKey(today);
  const monthOptions = useMemo(
    () =>
      Array.from(
        new Set([
          currentMonth,
          selectedMonth,
          ...orders.map((order) => monthKey(order.createdAt)),
          ...expenses.map((expense) => monthKey(expense.date)),
        ]),
      )
        .sort()
        .reverse(),
    [currentMonth, selectedMonth, orders, expenses],
  );
  const monthOrders = useMemo(
    () =>
      orders
        .filter((order) => monthKey(order.createdAt) === selectedMonth)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders, selectedMonth],
  );
  const monthExpenses = useMemo(
    () =>
      expenses.filter((expense) => monthKey(expense.date) === selectedMonth),
    [expenses, selectedMonth],
  );
  const revenue = monthOrders.reduce((sum, order) => sum + order.total, 0);
  const expenseTotal = monthExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const profit = revenue - expenseTotal;
  const recentOrders = monthOrders.slice(0, 5);
  const explanation =
    monthOrders.length || monthExpenses.length
      ? `In ${monthLabel(selectedMonth)}, you recorded ${monthOrders.length} paid order${monthOrders.length === 1 ? "" : "s"} worth ${fmt(revenue)} and logged ${monthExpenses.length} expense${monthExpenses.length === 1 ? "" : "s"} totalling ${fmt(expenseTotal)}. Your estimated profit is ${fmt(profit)}.`
      : `There are no paid orders or expenses recorded for ${monthLabel(selectedMonth)} yet.`;
  return (
    <>
      <PageHeader
        eyebrow="Business performance"
        title="Business summary"
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="gap-2 text-stone-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Button>
        }
      />
      <div className="max-w-4xl space-y-6">
        <section aria-labelledby="summary-period-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="summary-period-heading" className="text-base font-black">
                Month at a glance
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Review what came in, what went out, and which paid orders made
                up the result.
              </p>
            </div>
            <div className="w-full sm:w-56">
              <Label htmlFor="summary-month">View month</Label>
              <Select
                value={selectedMonth}
                items={monthOptions.map((option) => ({
                  value: option,
                  label: `${monthLabel(option)}${option === currentMonth ? " · This month" : ""}`,
                }))}
                onValueChange={(value) => onSelectMonth(String(value))}
              >
                <SelectTrigger id="summary-month" className="mt-2 h-11 w-full">
                  <SelectValue placeholder="Choose a month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {monthLabel(option)}
                      {option === currentMonth ? " · This month" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card className="mt-4 ring-0">
            <CardContent className="p-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
                <div>
                  <dt className="text-xs font-semibold text-stone-500">
                    Revenue
                  </dt>
                  <dd className="mt-1 text-xl font-black tracking-tight">
                    {fmt(revenue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-stone-500">
                    Expenses
                  </dt>
                  <dd className="mt-1 text-xl font-black tracking-tight">
                    {fmt(expenseTotal)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-stone-500">
                    Estimated profit
                  </dt>
                  <dd
                    className={`mt-1 text-xl font-black tracking-tight ${profit < 0 ? "text-rose-700" : "text-brand"}`}
                  >
                    {fmt(profit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-stone-500">
                    Paid orders
                  </dt>
                  <dd className="mt-1 text-xl font-black tracking-tight">
                    {monthOrders.length}
                  </dd>
                </div>
              </dl>
              <p className="mt-5 border-t border-stone-100 pt-4 text-sm leading-6 text-stone-600">
                {explanation}
              </p>
            </CardContent>
          </Card>
        </section>
        <section aria-labelledby="summary-orders-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="summary-orders-heading" className="text-base font-black">
                Orders in {monthLabel(selectedMonth)}
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {monthOrders.length} paid order{monthOrders.length === 1 ? "" : "s"} recorded this month.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onViewOrders(selectedMonth)}
              className="shrink-0"
            >
              View all orders
            </Button>
          </div>
          {recentOrders.length ? (
            <Card className="mt-3 overflow-hidden ring-0">
              <CardContent className="divide-y divide-stone-100 p-0">
                {recentOrders.map((order) => (
                  <SummaryOrderRow
                    key={order.id}
                    order={order}
                    onSelect={selectOrder}
                    showDate
                  />
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="mt-3 border-dashed ring-0">
              <CardContent className="p-5">
                <p className="font-bold">No paid orders recorded this month.</p>
                <p className="mt-1 text-sm text-stone-500">
                  Add an order to start building this month’s record.
                </p>
                <Button
                  type="button"
                  onClick={onAddOrder}
                  className="mt-4 bg-stone-950 text-white hover:bg-stone-700"
                >
                  <Plus className="h-4 w-4" />
                  Order
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
        <section aria-labelledby="summary-expenses-heading">
          <div>
            <h2 id="summary-expenses-heading" className="text-base font-black">
              Expenses in {monthLabel(selectedMonth)}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Costs logged against this month’s orders and business work.
            </p>
          </div>
          <Card className="mt-4 ring-0">
            <CardContent className="p-5">
              {monthExpenses.length ? (
                <div className="space-y-3">
                  {monthExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span>
                        <span className="block font-medium text-stone-700">
                          {expense.label}
                        </span>
                        <span className="block text-xs text-stone-400">
                          {dayLabel(expense.date)}
                        </span>
                      </span>
                      <span className="font-bold text-stone-950">
                        {fmt(expense.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  No expenses logged for this month.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}

function SummaryOrderHistory({
  today,
  orders,
  selectedMonth,
  onSelectMonth,
  onBack,
  onAddOrder,
  selectOrder,
}: {
  today: string;
  orders: Order[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onBack: () => void;
  onAddOrder: () => void;
  selectOrder: (order: Order) => void;
}) {
  const currentMonth = monthKey(today);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const monthOptions = useMemo(
    () =>
      Array.from(
        new Set([
          currentMonth,
          selectedMonth,
          ...orders.map((order) => monthKey(order.createdAt)),
        ]),
      )
        .sort()
        .reverse(),
    [currentMonth, selectedMonth, orders],
  );
  const monthOrders = useMemo(
    () =>
      orders
        .filter((order) => monthKey(order.createdAt) === selectedMonth)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders, selectedMonth],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOrders = useMemo(
    () =>
      monthOrders.filter((order) => {
        const matchesQuery =
          !normalizedQuery ||
          `${order.customer} ${order.product}`
            .toLocaleLowerCase()
            .includes(normalizedQuery);
        return (
          matchesQuery &&
          (statusFilter === "all" || order.status === statusFilter)
        );
      }),
    [monthOrders, normalizedQuery, statusFilter],
  );
  const orderDays = useMemo(() => {
    const groups = new Map<string, Order[]>();
    filteredOrders.forEach((order) => {
      const day = dayKey(order.createdAt);
      groups.set(day, [...(groups.get(day) ?? []), order]);
    });
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filteredOrders]);
  const hasFilters = Boolean(normalizedQuery || statusFilter !== "all");
  return (
    <>
      <PageHeader
        eyebrow="Business performance"
        title="Order history"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="gap-2 text-stone-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Summary
            </Button>
            <Button
              type="button"
              onClick={onAddOrder}
              className="bg-stone-950 text-white hover:bg-stone-700"
            >
              <Plus className="h-4 w-4" />
              Order
            </Button>
          </div>
        }
      />
      <section aria-label="Business order history" className="max-w-4xl space-y-4">
        <p className="text-sm text-stone-500">
          Browse paid orders by month. Newer orders appear first.
        </p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem_12rem]">
          <div className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer, product, or ID"
              aria-label="Search this month’s orders"
              className="h-11 pl-9"
            />
          </div>
          <div>
            <Label className="sr-only" htmlFor="history-month">
              View month
            </Label>
            <Select
              value={selectedMonth}
              items={monthOptions.map((month) => ({
                value: month,
                label: `${monthLabel(month)}${month === currentMonth ? " · This month" : ""}`,
              }))}
              onValueChange={(value) => onSelectMonth(String(value))}
            >
              <SelectTrigger id="history-month" className="h-11 w-full">
                <SelectValue placeholder="Choose a month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month} value={month}>
                    {monthLabel(month)}
                    {month === currentMonth ? " · This month" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="sr-only" htmlFor="history-status">
              Filter by order status
            </Label>
            <Select
              value={statusFilter}
              items={[
                { value: "all", label: "All statuses" },
                ...Object.entries(statusLabel).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
              onValueChange={(value) => setStatusFilter(String(value) as "all" | Status)}
            >
              <SelectTrigger id="history-status" className="h-11 w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(statusLabel).map(([value, label]) => (
                  <SelectItem key={value} value={value as Status}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <p aria-live="polite">
            Showing {filteredOrders.length} of {monthOrders.length} orders in {monthLabel(selectedMonth)}
          </p>
          {hasFilters && (
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
              className="h-auto p-0 text-brand"
            >
              Clear search and status
            </Button>
          )}
        </div>
        {filteredOrders.length ? (
          <Card className="overflow-hidden ring-0">
            <CardContent className="p-0">
              <div
                role="region"
                aria-label={`Scrollable order history for ${monthLabel(selectedMonth)}`}
                tabIndex={0}
                className="max-h-[min(68vh,720px)] overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
              >
                {orderDays.map(([day, dayOrders]) => (
                  <section
                    key={day}
                    aria-labelledby={`history-day-${day}`}
                    className="border-b border-stone-100 last:border-0"
                  >
                    <div className="sticky top-0 z-10 flex items-center justify-between border-y border-stone-100 bg-white/95 px-4 py-2 backdrop-blur first:border-t-0">
                      <h2
                        id={`history-day-${day}`}
                        className="text-xs font-semibold text-stone-700"
                      >
                        {dayLabel(day)}
                      </h2>
                      <span className="text-[11px] text-stone-500">
                        {dayOrders.length} order{dayOrders.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="divide-y divide-stone-100 px-1">
                      {dayOrders.map((order) => (
                        <SummaryOrderRow
                          key={order.id}
                          order={order}
                          onSelect={selectOrder}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed ring-0">
            <CardContent className="p-5">
              <p className="font-semibold text-stone-900">
                {monthOrders.length
                  ? "No orders match these filters."
                  : `No paid orders recorded in ${monthLabel(selectedMonth)}.`}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {monthOrders.length
                  ? "Try another search or status, or clear the filters."
                  : "Choose another month or add an order to begin this month’s history."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {hasFilters && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
                {!orders.length && (
                  <Button
                    type="button"
                    onClick={onAddOrder}
                    className="bg-stone-950 text-white hover:bg-stone-700"
                  >
                    <Plus className="h-4 w-4" />
                    Order
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}

export function StudioLoading() {
  return (
    <main className="min-h-screen bg-mist text-stone-900">
      <div className="mx-auto min-h-screen max-w-6xl bg-white sm:border-x sm:border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 sm:px-8">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-plaster" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-plaster" />
        </div>
        <section
          className="app-content space-y-5 px-5 pt-6 sm:px-8 sm:pt-9"
          aria-busy="true"
          aria-label="Loading Studio"
        >
          <div className="h-9 w-48 animate-pulse rounded-lg bg-plaster" />
          <div className="h-24 rounded-xl bg-plaster/70" />
          <div className="h-48 rounded-xl bg-plaster/70" />
        </section>
      </div>
    </main>
  );
}

export default function Home({
  userId,
  initialUserName,
  initialSummaryMonth,
}: {
  userId: string;
  initialUserName?: string | null;
  initialSummaryMonth?: string | null;
}) {
  const pathname = usePathname();
  const [clientPathname, setClientPathname] = useState(pathname);
  useEffect(() => {
    const syncPathname = () => setClientPathname(window.location.pathname);
    window.addEventListener("popstate", syncPathname);
    return () => window.removeEventListener("popstate", syncPathname);
  }, []);
  // App Router redirects can update pathname before the popstate listener gets
  // a chance to run. Prefer that newer pathname for the current render so a
  // sign-in redirect cannot briefly show the previous screen.
  const view = viewForPathname(
    pathname !== clientPathname ? pathname : clientPathname,
  );
  const navigate = (path: string) => {
    const destination = new URL(path, window.location.href);
    const nextUrl = `${destination.pathname}${destination.search}${destination.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentUrl === nextUrl) return;
    window.history.pushState(null, "", nextUrl);
    setClientPathname(destination.pathname);
  };
  const setView = (nextView: View) => navigate(viewPaths[nextView]);
  const storageKey = `${storageKeyPrefix}:${userId}`;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("[data-page-heading]")?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [view]);
  const [today, setToday] = useState("2000-01-01");
  const [summaryMonth, setSummaryMonth] = useState<string | null>(
    initialSummaryMonth ?? null,
  );
  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setToday(dateKey(new Date())),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [custom, setCustom] = useState(false);
  const [productId, setProductId] = useState("");
  const [saveProduct, setSaveProduct] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);
  const [actionMessage, setActionMessageState] = useState<ActionFeedback | null>(null);
  const actionMessageTimerRef = useRef<number | null>(null);
  const nextActionMessageIdRef = useRef(0);
  const setActionMessage = (
    text: string,
    type: ActionFeedback["type"] = "success",
  ) => {
    if (actionMessageTimerRef.current !== null) {
      window.clearTimeout(actionMessageTimerRef.current);
      actionMessageTimerRef.current = null;
    }
    if (!text) {
      setActionMessageState(null);
      return;
    }

    const id = ++nextActionMessageIdRef.current;
    setActionMessageState({ id, type, text });
    actionMessageTimerRef.current = window.setTimeout(() => {
      setActionMessageState((current) => (current?.id === id ? null : current));
      actionMessageTimerRef.current = null;
    }, type === "error" ? 5000 : 3000);
  };
  useEffect(
    () => () => {
      if (actionMessageTimerRef.current !== null) {
        window.clearTimeout(actionMessageTimerRef.current);
      }
    },
    [],
  );
  const [savedOrderConfirmation, setSavedOrderConfirmation] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [snoozed, setSnoozed] = useState<Record<string, string>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("order"),
  );
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    ownerName: initialUserName ?? undefined,
  });
  const [hydrated, setHydrated] = useState(false);
  const productImagesRef = useRef<string[]>([]);
  const businessLogoRef = useRef<string | undefined>(undefined);
  const pendingOrderSyncRef = useRef(new Set<string>());
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as StoredStudioState;
          if (Array.isArray(parsed.orders))
            setOrders(
              parsed.orders.filter(
                (order) => !legacyDemoOrderIds.has(order.id),
              ),
            );
          if (Array.isArray(parsed.products))
            setProducts(
              parsed.products.filter(
                (product) => !legacyDemoProductIds.has(product.id),
              ),
            );
          if (Array.isArray(parsed.expenses))
            setExpenses(
              parsed.expenses.filter(
                (expense) => !legacyDemoExpenseIds.has(expense.id),
              ),
            );
          if (
            parsed.settings &&
            typeof parsed.settings.workingDays === "number" &&
            typeof parsed.settings.reminderTime === "string"
          ) {
            setSettings({
              ...defaultSettings,
              ...parsed.settings,
              dueSoonDaysBefore: Array.isArray(parsed.settings.dueSoonDaysBefore)
                ? parsed.settings.dueSoonDaysBefore
                : defaultSettings.dueSoonDaysBefore,
              timeZone:
                typeof parsed.settings.timeZone === "string"
                  ? parsed.settings.timeZone
                  : defaultSettings.timeZone,
            });
          }
          if (Array.isArray(parsed.snoozed))
            setSnoozed(
              Object.fromEntries(
                parsed.snoozed.map((id) => [
                  id,
                  addCalendarDays(dateKey(new Date()), 1),
                ]),
              ),
            );
          else if (parsed.snoozed && typeof parsed.snoozed === "object")
            setSnoozed(parsed.snoozed);
          if (parsed.businessProfile)
            setBusinessProfile(parsed.businessProfile);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      } finally {
        setHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);
  useEffect(() => {
    if (!hydrated || today === "2000-01-01") return;
    let cancelled = false;
    fetch("/api/studio/bootstrap", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Studio data is not available from the database.");
        return response.json() as Promise<BootstrapPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        if (Array.isArray(payload.orders)) {
          const serverOrders = payload.orders.map((order) => ({
            ...order,
            due: order.dueDate
              ? dueLabelForDate(order.dueDate, today)
              : order.due,
            synced: true,
          }));
          const serverRequestIds = new Set(
            serverOrders.map((order) => order.clientRequestId).filter(Boolean),
          );
          setOrders((current) => [
            ...current.filter(
              (order) =>
                !order.synced &&
                !serverRequestIds.has(order.clientRequestId ?? ""),
            ),
            ...serverOrders,
          ]);
        }
        if (Array.isArray(payload.products)) {
          setProducts(payload.products);
          setProductId(
            (current) =>
              current ||
              payload.products?.find((product) => !product.archived)?.id ||
              "",
          );
        }
        if (Array.isArray(payload.expenses)) setExpenses(payload.expenses);
        if (payload.settings) setSettings(payload.settings);
        if (payload.profile) setBusinessProfile(payload.profile);
        if (payload.snoozed) setSnoozed(payload.snoozed);
      })
      .catch(() => {
        // Keep the local workspace usable when the database is temporarily unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, today]);
  useEffect(() => {
    if (!hydrated) return;
    const syncPendingOrders = async () => {
      if (!navigator.onLine) return;
      const pending = orders.filter(
        (order) => !order.synced && Boolean(order.clientRequestId),
      );
      for (const order of pending) {
        const requestId = order.clientRequestId as string;
        if (pendingOrderSyncRef.current.has(requestId)) continue;
        pendingOrderSyncRef.current.add(requestId);
        try {
          const response = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerName: order.customer,
              productName: order.product,
              productId: order.productId ?? null,
              amountPaid: order.total,
              dueDate: order.dueDate,
              notes: order.notes ?? "",
              clientRequestId: requestId,
              status: order.status,
            }),
          });
          const payload = (await response.json().catch(() => null)) as {
            order?: Order;
          } | null;
          if (!response.ok || !payload?.order) continue;
          const saved = {
            ...payload.order,
            due: payload.order.dueDate
              ? dueLabelForDate(payload.order.dueDate, today)
              : order.due,
            synced: true,
          };
          setOrders((items) =>
            items.map((item) =>
              item.id === order.id || item.clientRequestId === requestId
                ? saved
                : item,
            ),
          );
          setActionMessage("A pending order synced to your account.");
        } catch {
          // Keep the order queued for the next online event or app refresh.
        } finally {
          pendingOrderSyncRef.current.delete(requestId);
        }
      }
    };
    void syncPendingOrders();
    window.addEventListener("online", syncPendingOrders);
    return () => window.removeEventListener("online", syncPendingOrders);
  }, [hydrated, orders, today]);
  useEffect(() => {
    productImagesRef.current = products.flatMap((product) =>
      product.image ? [product.image] : [],
    );
  }, [products]);
  useEffect(() => {
    businessLogoRef.current = businessProfile.logo;
  }, [businessProfile.logo]);
  useEffect(
    () => () => {
      productImagesRef.current.forEach((image) => {
        if (image.startsWith("blob:")) URL.revokeObjectURL(image);
      });
      const logo = businessLogoRef.current;
      if (logo?.startsWith("blob:")) URL.revokeObjectURL(logo);
    },
    [],
  );
  useEffect(() => {
    if (!hydrated) return;
    const productsForStorage = products.map(({ image, ...product }) =>
      image?.startsWith("blob:")
        ? product
        : { ...product, ...(image ? { image } : {}) },
    );
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        orders,
        products: productsForStorage,
        expenses,
        settings,
        snoozed,
        businessProfile: {
          ownerName: businessProfile.ownerName,
          businessName: businessProfile.businessName,
          ...(businessProfile.logo ? { logo: businessProfile.logo } : {}),
        },
      } satisfies StoredStudioState),
    );
  }, [
    hydrated,
    orders,
    products,
    expenses,
    settings,
    snoozed,
    businessProfile.ownerName,
    businessProfile.businessName,
    businessProfile.logo,
    storageKey,
  ]);
  const dueOptions = useMemo(
    () => dueOptionsFor(today, settings.workingDays),
    [today, settings.workingDays],
  );
  const editingProductId = clientPathname?.match(
    /^\/products\/([^/]+)\/edit$/,
  )?.[1];
  const editingProduct =
    products.find((product) => product.id === editingProductId) ?? null;
  const activeProducts = products.filter((product) => !product.archived);
  const selected =
    products.find((product) => product.id === productId && !product.archived) ??
    activeProducts[0] ??
    products[0];
  const active = orders.filter((order) => order.status !== "delivered");
  const dueToday = useMemo(
    () =>
      active.filter(
        (order) => order.dueDate === today || order.due === "Today",
      ),
    [active, today],
  );
  const attentionOrders = useMemo(
    () =>
      active
        .filter(
          (order) =>
            !order.dueDate || order.dueDate <= addCalendarDays(today, settings.attentionDaysBefore),
        )
        .sort((a, b) => (a.dueDate ?? a.due).localeCompare(b.dueDate ?? b.due)),
    [active, today, settings.attentionDaysBefore],
  );
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const openAdd = (startWithCustomProduct = false) => {
    setMessage(null);
    setProductId(activeProducts[0]?.id ?? "");
    setCustom(startWithCustomProduct || activeProducts.length === 0);
    setView("add");
  };
  const openNewProduct = () => {
    setView("new_product");
  };
  const openEditProduct = (product: Product) => {
    navigate(`/products/${product.id}/edit`);
  };
  const saveProductRecord = async (product: Product) => {
    let savedProduct = product;
    let synced = false;
    try {
      const persisted = isUuid(product.id);
      const response = await fetch(
        persisted
          ? `/api/products/${encodeURIComponent(product.id)}`
          : "/api/products",
        {
          method: persisted ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: product.name,
            price: product.price,
            image: product.image ?? null,
            archived: product.archived ?? false,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        product?: Product;
        error?: string;
      } | null;
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500)
          throw new Error(payload?.error ?? "The product could not be saved.");
        throw new Error("temporary");
      }
      if (!payload?.product) throw new Error("temporary");
      savedProduct = payload.product;
      synced = true;
    } catch (saveError) {
      if (saveError instanceof Error && saveError.message !== "temporary")
        throw saveError;
    }
    if (
      editingProduct?.image &&
      editingProduct.image !== savedProduct.image &&
      editingProduct.image.startsWith("blob:")
    )
      URL.revokeObjectURL(editingProduct.image);
    setProducts((items) =>
      editingProduct
        ? items.map((item) =>
            item.id === editingProduct.id ? savedProduct : item,
          )
        : [...items, savedProduct],
    );
    setProductId(savedProduct.id);
    setView("products");
    setActionMessage(
      synced
        ? `${savedProduct.name} was saved to your product catalog.`
        : `${savedProduct.name} was saved on this device. It will sync when the database is available.`,
    );
  };
  const toggleProductArchive = async (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const nextProduct = { ...product, archived: !product.archived };
    setProducts((items) =>
      items.map((item) => (item.id === id ? nextProduct : item)),
    );
    if (isUuid(id)) {
      try {
        const response = await fetch(
          `/api/products/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: nextProduct.archived }),
          },
        );
        if (!response.ok) throw new Error("Archive state was not saved.");
      } catch {
        setProducts((items) =>
          items.map((item) => (item.id === id ? product : item)),
        );
        setActionMessage(
          "The product changed on this device, but the database could not be updated.",
          "error",
        );
        return;
      }
    }
    setActionMessage(
      `${product.name} was ${product.archived ? "restored to" : "moved to"} your active catalog.`,
    );
  };
  const deleteProduct = async (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return false;

    setProducts((items) => items.filter((item) => item.id !== id));
    if (productId === id) setProductId("");

    if (isUuid(id)) {
      try {
        const response = await fetch(
          `/api/products/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(
            payload?.error ?? "The product could not be deleted.",
          );
        }
      } catch (error) {
        setProducts((items) => [...items, product]);
        setActionMessage(
          error instanceof Error
            ? error.message
            : "The product could not be deleted. Try again.",
          "error",
        );
        return false;
      }
    }

    setActionMessage(`${product.name} was deleted from your catalog.`);
    return true;
  };
  const advance = async (id: string) => {
    const order = orders.find((item) => item.id === id);
    if (!order || order.status === "delivered") return;
    const next: Record<Status, Status> = {
      not_started: "in_progress",
      in_progress: "ready",
      ready: "delivered",
      delivered: "delivered",
    };
    const nextStatus = next[order.status];
    setOrders((items) =>
      items.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item,
      ),
    );
    if (order.synced) {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(order.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          },
        );
        if (!response.ok) throw new Error("Order status was not saved.");
      } catch {
        setOrders((items) =>
          items.map((item) =>
            item.id === id ? { ...item, status: order.status } : item,
          ),
        );
        setActionMessage(
          "The order changed on this device, but the database could not be updated. Try again.",
          "error",
        );
        return;
      }
    }
    setActionMessage(
      `${order.customer}'s order is now ${statusLabel[nextStatus].toLowerCase()}.`,
    );
  };
  const saveOrder = async (nextOrder: Order) => {
    const previous = orders.find((item) => item.id === nextOrder.id);
    if (!previous) return false;
    const persisted = isUuid(nextOrder.id);
    setOrders((items) =>
      items.map((item) => (item.id === nextOrder.id ? nextOrder : item)),
    );
    try {
      const response = await fetch(
        persisted
          ? `/api/orders/${encodeURIComponent(nextOrder.id)}`
          : "/api/orders",
        {
          method: persisted ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: nextOrder.customer,
            productName: nextOrder.product,
            productId: nextOrder.productId ?? null,
            amountPaid: nextOrder.total,
            dueDate: nextOrder.dueDate,
            notes: nextOrder.notes ?? "",
            ...(persisted
              ? {}
              : {
                  status: nextOrder.status,
                  clientRequestId: nextOrder.clientRequestId ?? nextOrder.id,
                }),
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        order?: Order;
        error?: string;
      } | null;
      if (!response.ok || !payload?.order)
        throw new Error(payload?.error ?? "The order could not be saved.");
      const saved = {
        ...payload.order,
        due: payload.order.dueDate
          ? dueLabelForDate(payload.order.dueDate, today)
          : nextOrder.due,
        synced: true,
      };
      setOrders((items) =>
        items.map((item) => (item.id === nextOrder.id ? saved : item)),
      );
      if (selectedOrderId === nextOrder.id && saved.id !== nextOrder.id)
        setSelectedOrderId(saved.id);
      setActionMessage(
        persisted
          ? "Order changes saved to your account."
          : "Offline order synced to your account.",
      );
      return true;
    } catch {
      if (persisted)
        setOrders((items) =>
          items.map((item) => (item.id === nextOrder.id ? previous : item)),
        );
      setActionMessage(
        persisted
          ? "The order could not be saved. Your previous details are still shown."
          : "This order is saved on the device and is waiting for the database.",
        persisted ? "error" : "success",
      );
      return false;
    }
  };
  const deleteOrder = async (order: Order) => {
    const removeFromVisibleOrders = () => {
      setOrders((items) => items.filter((item) => item.id !== order.id));
      setSelectedOrderId(null);
      setActionMessage("Order deleted from your account.");
    };

    if (!isUuid(order.id)) {
      setOrders((items) => items.filter((item) => item.id !== order.id));
      setSelectedOrderId(null);
      setActionMessage("Offline order removed from this device.");
      return true;
    }

    let deleteConfirmed = false;
    try {
      const result = await fetchJsonWithTimeout(
        `/api/orders/${encodeURIComponent(order.id)}`,
        { method: "DELETE" },
        15_000,
      );
      deleteConfirmed = result.ok;
    } catch {
      // The server may have completed the delete even if its response was lost.
    }

    if (deleteConfirmed) {
      removeFromVisibleOrders();
      return true;
    }

    let orderStillExists: boolean | null = null;
    try {
      const result = await fetchJsonWithTimeout(
        "/api/orders",
        { cache: "no-store" },
        5_000,
      );
      const payload = result.payload as { orders?: Array<{ id: string }> } | null;
      if (result.ok && Array.isArray(payload?.orders)) {
        orderStillExists = payload.orders.some((item) => item.id === order.id);
      }
    } catch {
      // Keep the order visible when the server's current state is unknown.
    }

    if (orderStillExists === false) {
      removeFromVisibleOrders();
      return true;
    }

    setActionMessage(
      orderStillExists
        ? "The order is still in your account. Refresh the list before retrying."
        : "We couldn't confirm whether the order was deleted. Refresh the list before retrying.",
      "error",
    );
    return false;
  };
  const toggleSnooze = async (id: string) => {
    const current =
      snoozed[id] && snoozed[id] > today ? snoozed[id] : undefined;
    const nextDate = current ? undefined : addCalendarDays(today, 1);
    const previous = snoozed;
    setSnoozed((items) => {
      const next = { ...items };
      if (nextDate) next[id] = nextDate;
      else delete next[id];
      return next;
    });
    if (!isUuid(id)) return;
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(id)}/snooze`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snoozedUntil: nextDate ?? null }),
        },
      );
      if (!response.ok) throw new Error("The reminder could not be updated.");
      setActionMessage(
        nextDate
          ? "Reminder snoozed until tomorrow."
          : "Reminder snooze removed.",
      );
    } catch {
      setSnoozed(previous);
      setActionMessage("The reminder could not be updated. Try again.", "error");
    }
  };
  const addExpense = async (expense: Expense) => {
    setExpenses((items) => [...items, expense]);
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: expense.label,
          amount: expense.amount,
          date: expense.date,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        expense?: Expense;
      } | null;
      if (!response.ok || !payload?.expense)
        throw new Error("Expense storage is not available.");
      setExpenses((items) =>
        items.map((item) =>
          item.id === expense.id ? (payload.expense as Expense) : item,
        ),
      );
      setActionMessage("Expense recorded to your account.");
    } catch {
      setActionMessage(
        "Expense recorded on this device. It will sync when the database is available.",
      );
    }
  };
  const addOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setActionMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const customer = String(data.get("customer") ?? "").trim();
    const product = custom
      ? String(data.get("customProduct") ?? "").trim()
      : (selected?.name ?? "");
    const total = parseMoneyInput(String(data.get("price") ?? ""));
    const customDueValue = String(data.get("customDueDate") ?? "").trim();
    const dueValue =
      customDueValue || String(data.get("due") ?? dueOptions[0]?.value ?? "");
    if (
      !isDateKey(dueValue) ||
      (customDueValue && customDueValue < today)
    ) {
      setMessage({
        type: "error",
        text: "Choose a valid due date today or later.",
      });
      return;
    }
    const due =
      dueOptions.find((option) => option.value === dueValue)?.label ??
      dueLabelForDate(dueValue, today);
    const notes = String(data.get("notes") ?? "").trim();
    if (!customer || !product) {
      setMessage({
        type: "error",
        text: "Add a customer name and product before saving.",
      });
      return;
    }
    if (total === null || total <= 0) {
      setMessage({
        type: "error",
        text: "Enter the amount paid using digits, optionally grouped like 2,500.",
      });
      return;
    }

    const existingProduct = custom
      ? products.find(
          (item) => item.name.toLowerCase() === product.toLowerCase(),
        )
      : selected;
    let savedProductId =
      existingProduct && isUuid(existingProduct.id) ? existingProduct.id : null;
    if (custom && saveProduct && !existingProduct) {
      const localProduct: Product = {
        id: `local-product-${Date.now()}`,
        name: product,
        price: total,
        color: "bg-plaster",
      };
      setProducts((items) => [...items, localProduct]);
      try {
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: product,
            price: total,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          product?: Product;
        } | null;
        if (response.ok && payload?.product) {
          savedProductId = payload.product.id;
          setProducts((items) =>
            items.map((item) =>
              item.id === localProduct.id ? (payload.product as Product) : item,
            ),
          );
        }
      } catch {
        // The order can still be saved while the new product remains local.
      }
    }

    const localId = `local-${Date.now()}`;
    setOrders((items) => [
      {
        id: localId,
        customer,
        product,
        due,
        dueDate: dueValue,
        total,
        status: "not_started",
        createdAt: today,
        notes,
        clientRequestId: localId,
        synced: false,
      },
      ...items,
    ]);
    form.reset();
    setCustom(false);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customer,
          productName: product,
          productId: savedProductId,
          amountPaid: total,
          dueDate: dueValue,
          notes,
          clientRequestId: localId,
        }),
      });
      if (!response.ok) throw new Error("Order storage is not available.");
      const payload = (await response.json()) as { order?: Order };
      const savedOrder = payload.order;
      if (!savedOrder) throw new Error("The saved order was not returned.");
      setOrders((items) =>
        items.map((item) =>
          item.id === localId
            ? {
                ...savedOrder,
                due: savedOrder.dueDate
                  ? dueLabelForDate(savedOrder.dueDate, today)
                  : due,
                synced: true,
              }
            : item,
        ),
      );
      setView("orders");
      setSavedOrderConfirmation({
        title: "Order saved",
        description: `${product} for ${customer} has been added to your orders.`,
      });
    } catch {
      setView("orders");
      setSavedOrderConfirmation({
        title: "Order saved on this device",
        description: `${product} for ${customer} is in your orders and will sync when your connection is available.`,
      });
    }
  };
  const saveBusinessProfile = async (profile: BusinessProfile) => {
    const nextProfile = {
      businessName: profile.businessName?.trim() || "My business",
      ownerName: profile.ownerName?.trim() ?? "",
      ...(profile.logo ? { logo: profile.logo } : {}),
    } satisfies BusinessProfile;
    setBusinessProfile(nextProfile);
    try {
      const response = await fetch("/api/business-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: nextProfile.businessName,
          ownerName: nextProfile.ownerName,
          logo: profile.logo ?? null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        profile?: BusinessProfile;
      } | null;
      if (!response.ok || !payload?.profile)
        throw new Error("Profile storage is not available.");
      // Keep the normalized draft visible immediately. The successful
      // response confirms the same values were accepted by the API, while
      // avoiding a stale read-back replacing the just-saved card.
      setBusinessProfile(nextProfile);
      setActionMessage("Business profile saved to your account.");
    } catch {
      setActionMessage(
        "Business profile saved on this device. It will sync when the database is available.",
      );
    }
  };
  const replaceLogo = (logo?: string) => {
    setBusinessProfile((profile) => {
      if (
        profile.logo &&
        profile.logo !== logo &&
        profile.logo.startsWith("blob:")
      )
        URL.revokeObjectURL(profile.logo);
      return { ...profile, logo };
    });
  };
  const changeSummaryMonth = (month: string) => {
    setSummaryMonth(month);
    if (view === "summary_orders") {
      const url = new URL(window.location.href);
      url.searchParams.set("month", month);
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  };
  if (!hydrated) return <StudioLoading />;
  return (
    <main className="min-h-screen bg-mist text-stone-900">
      <div className="mx-auto min-h-screen max-w-6xl bg-white sm:border-x sm:border-stone-200">
        <AppHeader
          setView={setView}
          businessLogo={businessProfile.logo}
          ownerName={businessProfile.ownerName}
        />
        <div className="grid lg:grid-cols-[190px_minmax(0,1fr)]">
          <Sidebar view={view} setView={setView} onAdd={openAdd} />
          <section className="app-content min-w-0 px-5 pb-24 pt-6 sm:px-8 sm:pt-9 lg:pb-10">
            {actionMessage && !savedOrderConfirmation && (
              <div
                key={actionMessage.id}
                role={actionMessage.type === "error" ? "alert" : "status"}
                aria-live={actionMessage.type === "error" ? "assertive" : "polite"}
                aria-atomic="true"
                className="pointer-events-none fixed inset-0 z-[100] grid place-items-center px-5"
              >
                <div
                  className={`studio-toast-enter flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-white px-5 py-4 text-sm font-semibold shadow-xl shadow-stone-950/15 ${actionMessage.type === "error" ? "border-rose-200 text-rose-800" : "border-brand/20 text-brand"}`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${actionMessage.type === "error" ? "bg-rose-50" : "bg-brand-soft"}`}
                  >
                    {actionMessage.type === "error" ? (
                      <X className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Check className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <p>{actionMessage.text}</p>
                </div>
              </div>
            )}
            {view === "today" && (
              <Today
                today={today}
                ownerName={businessProfile.ownerName}
                dueToday={dueToday}
                attention={attentionOrders}
                attentionDaysBefore={settings.attentionDaysBefore}
                overdueGraceDays={settings.overdueGraceDays}
                active={active}
                advance={advance}
                goAdd={openAdd}
                goOrders={() => setView("orders")}
                snoozed={snoozed}
                toggleSnooze={toggleSnooze}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "orders" && (
              <OrderManagement
                today={today}
                orders={orders}
                attentionDaysBefore={settings.attentionDaysBefore}
                overdueGraceDays={settings.overdueGraceDays}
                filter={filter}
                setFilter={setFilter}
                advance={advance}
                goAdd={openAdd}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "add" && (
              <Add
                dueOptions={dueOptions}
                products={activeProducts}
                selected={selected}
                productId={productId}
                setProductId={setProductId}
                custom={custom}
                setCustom={setCustom}
                saveProduct={saveProduct}
                setSaveProduct={setSaveProduct}
                addOrder={addOrder}
                message={message}
                workingDays={settings.workingDays}
                today={today}
              />
            )}{" "}
            {view === "products" && (
              <ProductCatalog
                products={products}
                goAdd={openNewProduct}
                onEdit={openEditProduct}
                onToggleArchive={toggleProductArchive}
                onDelete={deleteProduct}
              />
            )}{" "}
            {view === "new_product" && (
              <ProductEditor
                key={editingProduct?.id ?? "new"}
                initial={editingProduct}
                onCancel={() => setView("products")}
                onSave={saveProductRecord}
              />
            )}{" "}
            {view === "profile" && (
              <Profile
                today={today}
                businessLogo={businessProfile.logo}
                ownerName={businessProfile.ownerName}
                businessName={businessProfile.businessName}
                onOwnerNameChange={(ownerName) =>
                  setBusinessProfile((profile) => ({ ...profile, ownerName }))
                }
                onBusinessNameChange={(businessName) =>
                  setBusinessProfile((profile) => ({
                    ...profile,
                    businessName,
                  }))
                }
                onLogoChange={replaceLogo}
                onSaveProfile={saveBusinessProfile}
                onSettings={() => setView("settings")}
                onSummary={() => setView("summary")}
                revenue={orders.reduce((sum, order) => sum + order.total, 0)}
                delivered={
                  orders.filter((order) => order.status === "delivered").length
                }
                expenses={expenses}
                onAddExpense={addExpense}
              />
            )}{" "}
            {view === "summary" && (
              <BusinessSummary
                today={today}
                orders={orders}
                expenses={expenses}
                selectedMonth={summaryMonth ?? monthKey(today)}
                onSelectMonth={changeSummaryMonth}
                onBack={() => setView("profile")}
                onAddOrder={openAdd}
                onViewOrders={(month) => {
                  changeSummaryMonth(month);
                  navigate(`/summary/orders?month=${encodeURIComponent(month)}`);
                }}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "summary_orders" && (
              <SummaryOrderHistory
                today={today}
                orders={orders}
                selectedMonth={summaryMonth ?? monthKey(today)}
                onSelectMonth={changeSummaryMonth}
                onBack={() => setView("summary")}
                onAddOrder={openAdd}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "settings" && (
              <SettingsPanel
                settings={settings}
                onSave={(nextSettings) => {
                  setSettings(nextSettings);
                  setActionMessage("Settings saved.");
                }}
                onBack={() => setView("profile")}
              />
            )}
          </section>
        </div>
        <MobileNav view={view} setView={setView} onAdd={openAdd} />
        {selectedOrder && (
          <OrderDetail
            order={selectedOrder}
            advance={advance}
            onSave={saveOrder}
            onDelete={deleteOrder}
            close={() => setSelectedOrderId(null)}
          />
        )}
        <Dialog
          open={Boolean(savedOrderConfirmation)}
          onOpenChange={(open) => {
            if (!open) {
              setSavedOrderConfirmation(null);
              setActionMessage("");
            }
          }}
        >
          <DialogContent centered className="max-w-sm text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-7 w-7" aria-hidden="true" />
            </span>
            <DialogTitle className="mt-4 text-xl font-bold text-stone-950">
              {savedOrderConfirmation?.title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-stone-600">
              {savedOrderConfirmation?.description}
            </DialogDescription>
            <Button
              type="button"
              autoFocus
              onClick={() => {
                setSavedOrderConfirmation(null);
                setActionMessage("");
              }}
              className="mt-5 w-full bg-stone-950 text-white hover:bg-stone-700"
            >
              Continue to orders
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

function AppHeader({
  setView,
  businessLogo,
  ownerName,
}: {
  setView: (view: View) => void;
  businessLogo?: string;
  ownerName?: string;
}) {
  const logoStyle = businessLogo
    ? {
        backgroundImage: `url(${businessLogo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;
  const appIconStyle = {
    backgroundImage: "url('/icons/studio-192.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
      <Button
        variant="ghost"
        onClick={() => setView("today")}
        className="h-auto gap-2 p-0 text-left text-stone-950 hover:bg-transparent"
      >
        <span
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-brand"
          style={appIconStyle}
          aria-hidden="true"
        />
        <span className="text-lg font-bold tracking-tight">Studio</span>
      </Button>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setView("profile")}
          aria-label="Open business profile"
          title="Open business profile"
          className="overflow-hidden rounded-full bg-brand-soft p-0 font-bold text-brand"
        >
          {businessLogo ? (
            <span
              className="h-full w-full"
              style={logoStyle}
              aria-hidden="true"
            />
          ) : ownerName ? (
            initials(ownerName)
          ) : (
            <UserRound className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </header>
  );
}
function Sidebar({
  view,
  setView,
  onAdd,
}: {
  view: View;
  setView: (view: View) => void;
  onAdd: () => void;
}) {
  const activeView =
    view === "summary" || view === "summary_orders" ? "profile" : view;
  return (
    <aside className="hidden border-r border-stone-200 p-4 lg:block">
      <nav className="space-y-1" aria-label="Studio navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activeView === id ? "default" : "ghost"}
            onClick={() => (id === "add" ? onAdd() : setView(id))}
            aria-current={activeView === id ? "page" : undefined}
            className={`w-full justify-start gap-3 ${activeView === id ? "bg-brand text-white hover:bg-teal-800" : "text-stone-600"}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </nav>
      <Separator className="my-8" />
      <p className="px-3 text-xs font-bold text-stone-400">Your setup</p>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setView("settings")}
        aria-label="Open settings"
        title="Settings"
        aria-current={view === "settings" ? "page" : undefined}
        className="mt-2 text-stone-600"
      >
        <Settings2 className="h-5 w-5" aria-hidden="true" />
      </Button>
    </aside>
  );
}
function MobileNav({
  view,
  setView,
  onAdd,
}: {
  view: View;
  setView: (view: View) => void;
  onAdd: () => void;
}) {
  const activeView =
    view === "summary" || view === "summary_orders" ? "profile" : view;
  return (
    <nav
      className="mobile-navigation fixed z-30 flex max-w-6xl items-center gap-1 lg:hidden"
      aria-label="Mobile Studio navigation"
    >
      {navItems.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          variant="ghost"
          onClick={() => (id === "add" ? onAdd() : setView(id))}
          aria-label={label}
          aria-current={activeView === id ? "page" : undefined}
          title={label}
          className={`h-11 min-w-0 flex-1 justify-center rounded-xl px-0 ${activeView === id ? "text-stone-950" : "text-stone-400"}`}
        >
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${activeView === id ? "bg-brand text-white" : ""}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
        </Button>
      ))}
    </nav>
  );
}

function Today({
  today,
  ownerName,
  dueToday,
  attention,
  attentionDaysBefore,
  overdueGraceDays,
  active,
  advance,
  goAdd,
  goOrders,
  snoozed,
  toggleSnooze,
  selectOrder,
}: {
  today: string;
  ownerName?: string;
  dueToday: Order[];
  attention: Order[];
  attentionDaysBefore: number;
  overdueGraceDays: number;
  active: Order[];
  advance: (id: string) => void;
  goAdd: () => void;
  goOrders: () => void;
  snoozed: Record<string, string>;
  toggleSnooze: (id: string) => void;
  selectOrder: (order: Order) => void;
}) {
  const ready = active.filter((order) => order.status === "ready");
  const attentionIds = new Set(attention.map((order) => order.id));
  return (
    <>
      <PageHeader
        eyebrow={dateHeading(today)}
        title={ownerName ? `Good morning, ${ownerName}.` : "Good morning."}
        action={
          <Button
            onClick={() => goAdd()}
            className="bg-stone-950 text-white hover:bg-stone-700"
          >
            <Plus className="h-4 w-4" />
            Order
          </Button>
        }
      />
      <section
        aria-label="Order overview"
        className="homepage-metrics grid grid-cols-3 gap-2 sm:gap-4"
      >
        <Metric
          label="Needs attention"
          value={String(attention.length)}
          detail={`Due within ${attentionDaysBefore} ${attentionDaysBefore === 1 ? "day" : "days"} or overdue`}
          tone="metric-attention"
        />
        <Metric
          label="Active orders"
          value={String(active.length)}
          detail="Across this week"
          tone="metric-neutral"
        />
        <Metric
          label="Ready to send"
          value={String(ready.length)}
          detail={ready[0]?.product ?? "Nothing ready yet"}
          tone="metric-delivery"
        />
      </section>
      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold">Your next move</h2>
        {attention.length === 0 && (
          <Card className="border-dashed ring-0">
            <CardContent className="p-5">
              <p className="font-bold">
                You are clear for the next {attentionDaysBefore} days.
              </p>
              <p className="mt-1 text-sm text-stone-500">
                New paid orders will appear here {attentionDaysBefore} {attentionDaysBefore === 1 ? "day" : "days"} before they are due.
              </p>
            </CardContent>
          </Card>
        )}
        <div className="space-y-3">
          {attention.map((order) => {
            const isSnoozed = Boolean(
              snoozed[order.id] && snoozed[order.id] > today,
            );
            return (
              <Card key={order.id} className="priority-card ring-0">
                <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-plaster text-slate">
                      <Package className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-stone-600">
                        {dueAttentionLabel(order, today, overdueGraceDays)}
                      </p>
                      <h3 className="truncate text-sm font-semibold text-stone-950">
                        {order.product}
                      </h3>
                      <p className="truncate text-xs text-stone-500">
                        {order.customer}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[order.status]}`}>
                      {statusLabel[order.status]}
                    </span>
                  </div>
                  {isSnoozed && (
                    <p className="rounded-lg bg-plaster px-3 py-2 text-xs font-medium text-stone-600 sm:max-w-48">
                      Reminder snoozed until tomorrow. Deadline alerts remain
                      active.
                    </p>
                  )}
                  <div className="flex gap-2 sm:shrink-0">
                    <Button
                      size="sm"
                      onClick={() => advance(order.id)}
                      className="bg-stone-950 text-white hover:bg-stone-700"
                    >
                      {nextActionLabel[order.status] ?? "Update order"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleSnooze(order.id)}
                    >
                      {isSnoozed ? "Undo snooze" : "Remind me later"}
                    </Button>
                  </div>
              </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Up next</h2>
          <Button variant="link" onClick={goOrders} className="px-0 text-brand">
            See all orders
          </Button>
        </div>
        <Card className="px-4 ring-0">
          <CardContent className="p-0">
            {active
              .filter((order) => !attentionIds.has(order.id))
              .map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  today={today}
                  overdueGraceDays={overdueGraceDays}
                  advance={advance}
                  onSelect={selectOrder}
                />
              ))}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
function OrderManagementLegacy({
  today,
  orders,
  overdueGraceDays = 0,
  filter,
  setFilter,
  advance,
  goAdd,
  selectOrder,
}: {
  today: string;
  orders: Order[];
  overdueGraceDays?: number;
  filter: "all" | Status;
  setFilter: (value: "all" | Status) => void;
  advance: (id: string) => void;
  goAdd: () => void;
  selectOrder: (order: Order) => void;
}) {
  const [query, setQuery] = useState("");
  const filters: { id: "all" | Status; label: string }[] = [
    { id: "all", label: "All" },
    { id: "not_started", label: "Not started" },
    { id: "in_progress", label: "In progress" },
    { id: "ready", label: "Ready" },
    { id: "delivered", label: "Delivered" },
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOrders = useMemo(
    () =>
      orders
        .filter((order) => filter === "all" || order.status === filter)
        .filter(
          (order) =>
            !normalizedQuery ||
            `${order.customer} ${order.product}`
              .toLowerCase()
              .includes(normalizedQuery),
        )
        .sort((a, b) => {
          const rank = (order: Order) =>
            order.dueDate &&
            order.dueDate < today &&
            order.status !== "delivered"
              ? -1
              : order.due === "Today"
                ? 0
                : order.due === "Tomorrow"
                  ? 1
                  : order.status === "delivered"
                    ? 3
                    : 2;
          return rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt);
        }),
    [orders, filter, normalizedQuery, today],
  );
  return (
    <>
      <PageHeader
        eyebrow="Order tracker"
        title="Orders"
        action={
          <Button
            onClick={() => goAdd()}
            className="bg-stone-950 text-white hover:bg-stone-700"
          >
            <Plus className="h-4 w-4" />
            Order
          </Button>
        }
      />
      <section aria-label="Order management" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer, product, or order ID"
              aria-label="Search orders"
              className="h-11 pl-9"
            />
          </div>
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as "all" | Status)}
            className="min-w-0"
          >
            <TabsList className="flex w-full justify-start overflow-x-auto rounded-lg bg-muted p-1 sm:w-auto">
              <TabsTrigger
                value="all"
                className="whitespace-nowrap rounded-md px-3"
              >
                All{" "}
                <span className="ml-1 text-xs text-stone-500">
                  {orders.length}
                </span>
              </TabsTrigger>
              {filters.slice(1).map((item) => (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="whitespace-nowrap rounded-md px-3"
                >
                  {item.label}{" "}
                  <span className="ml-1 text-xs text-stone-500">
                    {orders.filter((order) => order.status === item.id).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <p aria-live="polite">
            {filteredOrders.length} paid order
            {filteredOrders.length === 1 ? "" : "s"}
            {normalizedQuery ? ` matching “${query.trim()}”` : ""}
          </p>
          <p>Due soon appears first</p>
        </div>
        <Card className="px-4 ring-0">
          <CardContent className="p-0">
            {filteredOrders.length ? (
              filteredOrders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  today={today}
                  overdueGraceDays={overdueGraceDays}
                  advance={advance}
                  onSelect={selectOrder}
                />
              ))
            ) : (
              <div className="py-14 text-center">
                <p className="font-semibold text-stone-950">
                  No orders match this view.
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Try another status, search term, or add a confirmed paid
                  order.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {normalizedQuery && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setQuery("")}
                    >
                      Clear search
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => goAdd()}
                    className="bg-stone-950 text-white hover:bg-stone-700"
                  >
                    <Plus className="h-4 w-4" />
                    Order
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function Add({
  dueOptions,
  products,
  selected,
  productId,
  setProductId,
  custom,
  setCustom,
  saveProduct,
  setSaveProduct,
  addOrder,
  message,
  workingDays,
  today,
}: {
  dueOptions: { value: string; label: string }[];
  products: Product[];
  selected?: Product;
  productId: string;
  setProductId: (id: string) => void;
  custom: boolean;
  setCustom: (value: boolean) => void;
  saveProduct: boolean;
  setSaveProduct: (value: boolean) => void;
  addOrder: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  message: Message | null;
  workingDays: number;
  today: string;
}) {
  const [dueOpen, setDueOpen] = useState(false);
  const [useCustomDueDate, setUseCustomDueDate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const selectedPrice = selected?.price ?? 0;
  const productOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    if (isSaving) {
      event.preventDefault();
      return;
    }
    setIsSaving(true);
    try {
      await addOrder(event);
    } finally {
      setIsSaving(false);
    }
  };
  const focusProduct = (index: number) => {
    const product = products[index];
    if (!product) return;
    setProductId(product.id);
    productOptionRefs.current[index]?.focus();
  };
  const moveProduct = (index: number, direction: number) => {
    const nextIndex = (index + direction + products.length) % products.length;
    focusProduct(nextIndex);
  };
  return (
    <>
      <PageHeader eyebrow="Confirmed orders only" title="Add a paid order" />
      <form onSubmit={submit} className="max-w-2xl space-y-5">
        <section>
          <Label htmlFor="customer">Customer name</Label>
          <Input
            required
            id="customer"
            name="customer"
            maxLength={160}
            placeholder="e.g. Customer name"
            className="mt-2 h-11"
          />
        </section>
        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>What did they order?</Label>
              <p className="mt-1 text-xs text-stone-500">
                Pick a product or tap + to add one.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setCustom(!custom)}
              aria-label={custom ? "Choose from catalog" : "Add product"}
              title={custom ? "Choose from catalog" : "Add product"}
              className="rounded-full border-brand bg-brand text-white hover:border-teal-800 hover:bg-teal-800"
            >
              <span
                className={`transition-transform duration-200 ${custom ? "rotate-0" : ""}`}
              >
                {custom ? <ArrowLeft /> : <Plus />}
              </span>
            </Button>
          </div>
          {custom ? (
            <Card className="mt-3 border-dashed border-teal-300 bg-brand-soft ring-0">
              <CardContent className="p-4">
                <Label htmlFor="customProduct" className="text-xs text-brand">
                  New product name
                </Label>
                <Input
                  required
                  id="customProduct"
                  name="customProduct"
                  placeholder="e.g. Linen co-ord set"
                  className="mt-2 bg-white"
                />
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700">
                  <Checkbox
                    checked={saveProduct}
                    onCheckedChange={(value) => setSaveProduct(value === true)}
                  />
                  Save to my product catalog for next time
                </label>
                <p className="mt-1 ml-6 text-xs text-stone-500">
                  You can add an image later. It is always optional.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div
              role="radiogroup"
              aria-label="Choose a product"
              className="mt-3 grid gap-2 sm:grid-cols-2"
            >
              {products.map((product, index) => (
                <Button
                  type="button"
                  key={product.id}
                  ref={(element) => { productOptionRefs.current[index] = element; }}
                  variant="outline"
                  role="radio"
                  aria-checked={productId === product.id}
                  tabIndex={productId === product.id ? 0 : -1}
                  onClick={() => setProductId(product.id)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "ArrowRight" ||
                      event.key === "ArrowDown"
                    ) {
                      event.preventDefault();
                      moveProduct(index, 1);
                    }
                    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                      event.preventDefault();
                      moveProduct(index, -1);
                    }
                    if (event.key === "Home") {
                      event.preventDefault();
                      focusProduct(0);
                    }
                    if (event.key === "End") {
                      event.preventDefault();
                      focusProduct(products.length - 1);
                    }
                  }}
                  className={`h-auto min-h-16 justify-start gap-3 rounded-xl p-3 text-left ${productId === product.id ? "border-brand bg-brand-soft" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${product.color}`}
                    style={
                      product.image
                        ? {
                            backgroundImage: `url(${product.image})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  >
                    {!product.image && (
                      <ImageIcon
                        className="h-4 w-4 text-stone-500/70"
                        aria-hidden="true"
                      />
                    )}
                    {productId === product.id && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {product.name}
                    </span>
                    <span className="block text-xs text-stone-500">
                      {fmt(product.price)}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          )}
        </section>
        <section className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="price">Amount paid</Label>
            <Input
              required
              key={custom ? "custom" : (selected?.id ?? "no-product")}
              id="price"
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={custom ? "" : selectedPrice || ""}
              placeholder={
                selectedPrice ? String(selectedPrice) : "Enter amount paid"
              }
              className="mt-2 h-11"
            />
            <p className="mt-1 text-xs text-stone-500">
              Payment confirmed before recording.
            </p>
          </div>
          <div className={dueOpen ? "pb-24 sm:pb-0" : ""}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label htmlFor={useCustomDueDate ? "custom-due-date" : "due"}>
                Due date
              </Label>
              <span className="text-xs text-stone-500">
                Default: {workingDays} working days
              </span>
            </div>
            {useCustomDueDate ? (
              <div>
                <Input
                  required
                  id="custom-due-date"
                  name="customDueDate"
                  type="date"
                  min={today}
                  className="h-11"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Set an earlier date for an express or specially scheduled order.
                </p>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setUseCustomDueDate(false)}
                  className="mt-1 h-11 justify-start px-0 text-brand"
                >
                  <CalendarDays aria-hidden="true" />
                  Use suggested dates
                </Button>
              </div>
            ) : (
              <>
                <Select
                  name="due"
                  items={dueOptions}
                  defaultValue={dueOptions[0]?.value}
                  open={dueOpen}
                  onOpenChange={setDueOpen}
                >
                  <SelectTrigger id="due" className="h-11 w-full">
                    <SelectValue placeholder="Choose a due date" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {dueOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setUseCustomDueDate(true)}
                  className="mt-1 h-11 justify-start px-0 text-brand"
                >
                  <CalendarDays aria-hidden="true" />
                  Choose a specific date
                </Button>
              </>
            )}
          </div>
        </section>
        <section>
          <Label htmlFor="notes">
            Notes <span className="font-normal text-stone-400">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            name="notes"
            maxLength={2000}
            rows={3}
            placeholder="Colour, size, delivery details, or anything useful."
            className="mt-2"
          />
        </section>
        {message && (
          <p
            role={message.type === "error" ? "alert" : "status"}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${message.type === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}
          >
            {message.text}
          </p>
        )}
        <div className="order-save">
          <Button
            type="submit"
            disabled={isSaving}
            className="h-11 w-full bg-brand text-white hover:bg-teal-800"
          >
            {isSaving ? "Saving…" : "Save Order"}
          </Button>
        </div>
      </form>
    </>
  );
}

function Products({
  products,
  goAdd,
  onEdit,
}: {
  products: Product[];
  goAdd: () => void;
  onEdit: (product: Product) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Reusable catalog"
        title="Products"
        action={
          <Button
            onClick={goAdd}
            variant="outline"
            size="icon-lg"
            aria-label="Add a new product"
            title="Add a new product"
            className="rounded-full border-brand bg-brand text-white hover:border-teal-800 hover:bg-teal-800"
          >
            <Plus />
          </Button>
        }
      />
      <p className="mb-5 max-w-xl text-sm text-stone-500">
        Save products you sell regularly so a new paid order takes only a few
        taps. Images are optional.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {products.map((product) => (
          <Card key={product.id} className="ring-0">
            <CardContent className="flex items-center gap-4 p-4">
              <div
                role="img"
                aria-label={
                  product.image
                    ? `${product.name} product image`
                    : "No product image uploaded"
                }
                className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${product.color}`}
                style={
                  product.image
                    ? {
                        backgroundImage: `url(${product.image})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                {!product.image && (
                  <ImageIcon
                    className="h-5 w-5 text-stone-500/70"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-black">{product.name}</h2>
                <p className="mt-1 text-xs text-stone-500">
                  {fmt(product.price)}
                </p>
                <p className="mt-2 text-xs font-semibold text-stone-500">
                  {product.image ? "Image added" : "No image yet"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(product)}
              >
                Edit
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
function NewProduct({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Product | null;
  onCancel: () => void;
  onSave: (product: Product) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [image, setImage] = useState(initial?.image);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const ownedImageRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (ownedImageRef.current) URL.revokeObjectURL(ownedImageRef.current);
    },
    [],
  );
  const handleImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (ownedImageRef.current) URL.revokeObjectURL(ownedImageRef.current);
    const nextImage = URL.createObjectURL(file);
    ownedImageRef.current = nextImage;
    setImage(nextImage);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const numericPrice = parseMoneyInput(price);
    if (!cleanName || numericPrice === null || numericPrice <= 0) {
      setError("Add a product name and a valid price, such as 25,000.");
      return;
    }
    if (isSaving) return;
    setIsSaving(true);
    ownedImageRef.current = null;
    onSave({
      id: initial?.id ?? `p${Date.now()}`,
      name: cleanName,
      price: numericPrice,
      color: initial?.color ?? "bg-plaster",
      image,
    });
  };
  return (
    <>
      <PageHeader
        eyebrow="Reusable catalog"
        title={initial ? "Edit product" : "Add a product"}
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="gap-2 text-stone-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Button>
        }
      />
      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <Card className="ring-0">
          <CardContent className="space-y-5 p-5">
            <div>
              <Label htmlFor="product-name">Product name</Label>
              <Input
                required
                id="product-name"
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Linen co-ord set"
                className="mt-2 h-11"
              />
            </div>
            <div className="max-w-sm">
              <div>
                <Label htmlFor="product-price">Price</Label>
                <Input
                  required
                  id="product-price"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 25,000"
                  className="mt-2 h-11"
                />
              </div>
            </div>
            <label
              htmlFor="product-image"
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 transition-colors hover:border-teal-300 hover:bg-brand-soft"
            >
              <div
                role="img"
                aria-label={
                  image
                    ? `${name || "Product"} image preview`
                    : "No product image selected"
                }
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-stone-400 ring-1 ring-stone-200"
                style={
                  image
                    ? {
                        backgroundImage: `url(${image})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                {!image && <ImageIcon className="h-5 w-5" aria-hidden="true" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">
                  {image ? "Change product image" : "Add product image"}
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Optional. Use a clear image as a visual shortcut when
                  recording an order.
                </p>
              </div>
            </label>
            <Input
              id="product-image"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleImage}
            />
          </CardContent>
        </Card>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={isSaving}
          className="w-full bg-brand py-3 text-white hover:bg-teal-800"
        >
          {isSaving ? "Saving…" : initial ? "Save changes" : "Save product"}
        </Button>
      </form>
    </>
  );
}
function ProductCatalog({
  products,
  goAdd,
  onEdit,
  onToggleArchive,
  onDelete,
}: {
  products: Product[];
  goAdd: () => void;
  onEdit: (product: Product) => void;
  onToggleArchive: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [deleteCandidate, setDeleteCandidate] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const activeCount = products.filter((product) => !product.archived).length;
  const archivedCount = products.length - activeCount;
  const visibleProducts = products
    .filter((product) =>
      filter === "archived" ? product.archived : !product.archived,
    )
    .filter(
      (product) =>
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery),
    );
  const filterLabel =
    filter === "active" ? "active products" : "archived products";
  return (
    <>
      <PageHeader
        title="Products"
        action={
          <Button
            onClick={goAdd}
            variant="outline"
            size="icon-lg"
            aria-label="Add a new product"
            title="Add a new product"
            className="rounded-full border-brand bg-brand text-white hover:border-teal-800 hover:bg-teal-800"
          >
            <Plus />
          </Button>
        }
      />
      <p className="max-w-xl text-sm text-stone-500">
        Save products you sell regularly so a new paid order takes only a few
        Keep product names and prices ready for faster order entry. Images are
        optional.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className="h-11 pl-9"
          />
        </div>
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as "active" | "archived")}
        >
          <TabsList className="w-full rounded-lg bg-muted p-1 sm:w-auto">
            <TabsTrigger
              value="active"
              className="flex-1 rounded-md px-3 sm:flex-none"
            >
              Active{" "}
              <span className="ml-1 text-xs text-stone-500">{activeCount}</span>
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="flex-1 rounded-md px-3 sm:flex-none"
            >
              Archived{" "}
              <span className="ml-1 text-xs text-stone-500">
                {archivedCount}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 text-xs text-stone-500">
        <p>
          {visibleProducts.length} {filterLabel}
          {normalizedQuery ? ` matching “${query.trim()}”` : ""}
        </p>
        {filter === "active" && <p>Shown when recording an order</p>}
      </div>
      {visibleProducts.length ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {visibleProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden ring-0">
              <CardContent className="p-0">
                <div
                  role="img"
                  aria-label={
                    product.image
                      ? `${product.name} product image`
                      : "No product image uploaded"
                  }
                  className={`relative flex aspect-[4/3] items-center justify-center ${product.color}`}
                  style={
                    product.image
                      ? {
                          backgroundImage: `url(${product.image})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {!product.image && (
                    <ImageIcon
                      className="h-8 w-8 text-stone-500/60"
                      aria-hidden="true"
                    />
                  )}
                  {product.archived && (
                    <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-stone-600">
                      Archived
                    </span>
                  )}
                </div>
                <div className="space-y-4 p-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-stone-950">
                      {product.name}
                    </h2>
                    <div className="mt-2 text-sm">
                      <p className="text-xs text-stone-500">Price</p>
                      <p className="mt-0.5 font-semibold text-stone-950">
                        {fmt(product.price)}
                      </p>
                    </div>
                    <p className="mt-3 text-xs text-stone-500">
                      {product.image ? "Product image added" : "No image added"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(product)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onToggleArchive(product.id)}
                      aria-label={
                        product.archived
                          ? `Restore ${product.name}`
                          : `Archive ${product.name}`
                      }
                      title={
                        product.archived ? "Restore product" : "Archive product"
                      }
                      className="text-stone-500 hover:bg-brand-soft hover:text-brand"
                    >
                      {product.archived ? <ArchiveRestore /> : <Archive />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteCandidate(product)}
                      aria-label={`Delete ${product.name}`}
                      title="Delete product"
                      className="text-stone-500 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="mt-3 border-dashed ring-0">
          <CardContent className="p-6">
            <p className="font-semibold text-stone-950">
              {normalizedQuery
                ? `No ${filterLabel} match that search.`
                : `No ${filterLabel} yet.`}
            </p>
            <p className="mt-1 max-w-md text-sm leading-5 text-stone-500">
              {normalizedQuery
                ? "Try another product name or clear the search."
                : filter === "active"
                  ? "Add the products you sell regularly so order entry stays quick."
                  : "Archived products stay out of new orders and remain available here for reference."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {normalizedQuery && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuery("")}
                >
                  Clear search
                </Button>
              )}
              {filter === "active" && (
                <Button
                  type="button"
                  onClick={goAdd}
                  className="bg-brand text-white hover:bg-teal-800"
                >
                  <Plus className="h-4 w-4" />
                  Add a product
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog
        open={Boolean(deleteCandidate)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteCandidate(null);
        }}
      >
        <DialogContent>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold text-stone-950">
                Delete product?
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-6 text-stone-500">
                {deleteCandidate
                  ? `Remove ${deleteCandidate.name} from your catalog? Existing paid orders will stay in your history.`
                  : ""}
              </DialogDescription>
            </div>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close delete confirmation"
                  disabled={isDeleting}
                >
                  <X />
                </Button>
              }
            />
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteCandidate(null)}
              disabled={isDeleting}
            >
              Keep product
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={() => {
                if (!deleteCandidate) return;
                setIsDeleting(true);
                void onDelete(deleteCandidate.id).then((deleted) => {
                  setIsDeleting(false);
                  if (deleted) setDeleteCandidate(null);
                });
              }}
              className="bg-rose-700 text-white hover:bg-rose-800"
            >
              {isDeleting ? "Deleting…" : "Delete product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Product | null;
  onCancel: () => void;
  onSave: (product: Product) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [image, setImage] = useState(initial?.image);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const ownedImageRef = useRef<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(
    () => () => {
      if (ownedImageRef.current) URL.revokeObjectURL(ownedImageRef.current);
    },
    [],
  );
  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Choose an image file for this product.");
      input.value = "";
      return;
    }
    if (isUploading) return;
    setIsUploading(true);
    setImageError("");
    try {
      setImage(await uploadImage(file, "products"));
    } catch (uploadError) {
      setImageError(
        uploadError instanceof Error
          ? uploadError.message
          : "The image upload failed. Try again.",
      );
    } finally {
      setIsUploading(false);
      input.value = "";
    }
  };
  const clearImage = () => setImage(undefined);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const numericPrice = parseMoneyInput(price);
    if (
      !cleanName ||
      numericPrice === null ||
      numericPrice <= 0
    ) {
      setError("Add a product name and a valid price, such as 25,000.");
      return;
    }
    if (isSaving || isUploading) return;
    setIsSaving(true);
    setError("");
    try {
      await onSave({
        id: initial?.id ?? `p${Date.now()}`,
        name: cleanName,
        price: numericPrice,
        color: initial?.color ?? "bg-plaster",
        image,
        archived: initial?.archived,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The product could not be saved.",
      );
      setIsSaving(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Product catalog"
        title={initial ? "Edit product" : "Add a product"}
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="gap-2 text-stone-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Button>
        }
      />
      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <Card className="ring-0">
          <CardContent className="space-y-5 p-5">
            <div>
              <Label htmlFor="product-name">Product name</Label>
              <Input
                required
                id="product-name"
                maxLength={160}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                placeholder="e.g. Linen co-ord set"
                className="mt-2 h-11"
              />
            </div>
            <div className="max-w-sm">
              <div>
                <Label htmlFor="product-price">Price</Label>
                <Input
                  required
                  id="product-price"
                  value={price}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    setError("");
                  }}
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 25,000"
                  className="mt-2 h-11"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Used as the default amount when recording an order.
                </p>
              </div>
            </div>
            <div className="relative">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                aria-hidden="true"
                tabIndex={-1}
                className="sr-only"
                onChange={handleImage}
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="outline"
                aria-label={image ? "Change product image" : "Add product image"}
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploading}
                className="h-auto min-h-20 w-full justify-start gap-3 whitespace-normal rounded-xl border-dashed border-stone-200 bg-stone-50 p-4 text-left hover:border-teal-300 hover:bg-brand-soft"
              >
                <div
                  role="img"
                  aria-label={
                    image
                      ? `${name || "Product"} image preview`
                      : "No product image selected"
                  }
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-stone-400 ring-1 ring-stone-200"
                  style={
                    image
                      ? {
                          backgroundImage: `url(${image})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {!image && (
                    <ImageIcon className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-800">
                    {isUploading
                      ? "Compressing and uploading…"
                      : image
                        ? "Change product image"
                        : "Add product image"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Tap to choose a photo. Studio resizes it before sending it
                    to Cloudinary so it loads quickly on phones.
                  </p>
                </div>
              </Button>
              {image && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearImage}
                  disabled={isUploading}
                  className="mt-2 gap-2 px-0 text-stone-500 hover:bg-transparent hover:text-stone-950"
                >
                  <X className="h-4 w-4" />
                  Remove image
                </Button>
              )}
              {imageError && (
                <p
                  role="alert"
                  className="mt-2 text-sm font-medium text-rose-800"
                >
                  {imageError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={isSaving || isUploading}
          className="w-full bg-brand py-3 text-white hover:bg-teal-800"
        >
          {isSaving
            ? "Saving…"
            : isUploading
              ? "Uploading…"
              : initial
                ? "Save changes"
                : "Save product"}
        </Button>
      </form>
    </>
  );
}

function ProfileLegacy({
  today,
  businessLogo,
  ownerName,
  businessName,
  onOwnerNameChange,
  onBusinessNameChange,
  onLogoChange,
  onSaveProfile,
  onSettings,
  onSummary,
  revenue,
  delivered,
  expenses,
  onAddExpense,
}: {
  today: string;
  businessLogo?: string;
  ownerName?: string;
  businessName?: string;
  onOwnerNameChange: (name: string) => void;
  onBusinessNameChange: (name: string) => void;
  onLogoChange: (logo?: string) => void;
  onSaveProfile: (profile: BusinessProfile) => Promise<void>;
  onSettings: () => void;
  onSummary: () => void;
  revenue: number;
  delivered: number;
  expenses: Expense[];
  onAddExpense: (expense: Expense) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [expenseError, setExpenseError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const displayBusinessName = businessName?.trim() || "Your business";
  const displayOwnerName = ownerName?.trim() || "Add your name";
  const logoStyle = businessLogo
    ? {
        backgroundImage: `url(${businessLogo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;
  const handleLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Choose an image file for your business logo.");
      return;
    }
    if (isUploadingLogo) return;
    setIsUploadingLogo(true);
    setLogoError("");
    try {
      onLogoChange(await uploadImage(file, "logos"));
    } catch (uploadError) {
      setLogoError(
        uploadError instanceof Error
          ? uploadError.message
          : "The image upload failed. Try again.",
      );
    } finally {
      setIsUploadingLogo(false);
      event.target.value = "";
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const cleanLabel = label.trim();
    const numericAmount = parseMoneyInput(amount);
    if (!cleanLabel || numericAmount === null || numericAmount <= 0 || !date) {
      setExpenseError("Enter a valid amount, such as 5,000.");
      return;
    }
    setExpenseError("");
    setIsSaving(true);
    await onAddExpense({
      id: `e${Date.now()}`,
      label: cleanLabel,
      amount: numericAmount,
      date,
    });
    setLabel("");
    setAmount("");
    setDate(today);
    setShowForm(false);
    setIsSaving(false);
  };
  const finishProfileEdit = async () => {
    if (isSavingProfile) return;
    setIsSavingProfile(true);
    await onSaveProfile({ logo: businessLogo, ownerName, businessName });
    setIsSavingProfile(false);
    setIsEditing(false);
  };
  return (
    <>
      <PageHeader
        title="Profile"
        action={
          <Button
            type="button"
            variant="outline"
            onClick={onSettings}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            Settings
          </Button>
        }
      />
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
        {isEditing ? (
          <Card className="lg:col-start-1 lg:row-start-1 ring-0">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-stone-950">
                    Edit profile
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Update the identity that appears in Studio.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void finishProfileEdit()}
                  disabled={isSavingProfile}
                  className="shrink-0 text-stone-600"
                >
                  {isSavingProfile ? "Saving…" : "Done"}
                </Button>
              </div>
              <div className="space-y-4">
                <label
                  htmlFor="business-logo"
                  className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 transition-colors hover:border-teal-300 hover:bg-brand-soft"
                >
                  <div
                    role="img"
                    aria-label={
                      businessLogo
                        ? "Business logo preview"
                        : "No business logo selected"
                    }
                    className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-brand"
                    style={logoStyle}
                  >
                    {!businessLogo && (
                      <ImageIcon className="h-7 w-7" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-stone-950">
                      Business image
                    </p>
                    <p className="mt-1 max-w-sm text-sm leading-5 text-stone-500">
                      Add a brand image so your business is recognizable in the
                      app.
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                      {isUploadingLogo
                        ? "Compressing and uploading…"
                        : businessLogo
                          ? "Change image"
                          : "Add image"}
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </label>
                <Input
                  id="business-logo"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleLogo}
                  disabled={isUploadingLogo}
                />
                {logoError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
                  >
                    {logoError}
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="business-name">Business name</Label>
                    <Input
                      id="business-name"
                      value={businessName ?? ""}
                      onChange={(event) =>
                        onBusinessNameChange(event.target.value)
                      }
                      placeholder="e.g. Studio by Jutin"
                      className="mt-2 h-11"
                    />
                    <p className="mt-1 text-xs text-stone-500">
                      The brand name shown on your profile.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="owner-name">Your name</Label>
                    <Input
                      id="owner-name"
                      value={ownerName ?? ""}
                      onChange={(event) =>
                        onOwnerNameChange(event.target.value)
                      }
                      placeholder="Your name"
                      className="mt-2 h-11"
                    />
                    <p className="mt-1 text-xs text-stone-500">
                      Used in your welcome message.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-start-1 lg:row-start-1 ring-0">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    role="img"
                    aria-label={
                      businessLogo
                        ? "Business image"
                        : "Business image not added"
                    }
                    className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-brand"
                    style={logoStyle}
                  >
                    {!businessLogo &&
                      (businessName || ownerName ? (
                        <span className="text-xl font-bold">
                          {initials(businessName || ownerName)}
                        </span>
                      ) : (
                        <ImageIcon className="h-7 w-7" aria-hidden="true" />
                      ))}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-500">
                      Business profile
                    </p>
                    <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-stone-950">
                      {displayBusinessName}
                    </h2>
                    <p className="mt-1 truncate text-sm text-stone-600">
                      {displayOwnerName}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  aria-label="Edit business profile"
                  className="shrink-0 gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              </div>
              {!businessLogo && (
                <p className="mt-5 border-t border-stone-100 pt-4 text-sm leading-5 text-stone-500">
                  Add a business image from Edit profile when you are ready to
                  show your brand here.
                </p>
              )}
            </CardContent>
          </Card>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onSummary}
          aria-label="Open business summary"
          className="order-2 h-full min-h-44 w-full items-start justify-between rounded-xl border-stone-200 bg-white p-5 text-left whitespace-normal hover:bg-mist lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <span className="block min-w-0 flex-1">
            <span className="block text-base font-semibold text-stone-950">
              Business summary
            </span>
            <span className="mt-1 block text-sm leading-5 text-stone-500">
              Review monthly profit, expenses, and the orders that made them.
            </span>
            <span className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-200 pt-3">
              <span>
                <span className="block text-[11px] font-semibold text-stone-500">
                  Revenue
                </span>
                <span className="mt-1 block truncate text-sm font-bold text-stone-950">
                  {fmt(revenue)}
                </span>
              </span>
              <span>
                <span className="block text-[11px] font-semibold text-stone-500">
                  Expenses
                </span>
                <span className="mt-1 block truncate text-sm font-bold text-stone-950">
                  {fmt(totalExpenses)}
                </span>
              </span>
              <span>
                <span className="block text-[11px] font-semibold text-stone-500">
                  Delivered
                </span>
                <span className="mt-1 block text-sm font-bold text-stone-950">
                  {delivered}
                </span>
              </span>
            </span>
          </span>
          <ChevronRight
            className="mt-1 h-5 w-5 shrink-0 text-stone-400"
            aria-hidden="true"
          />
        </Button>
        <Card className="order-3 lg:col-start-1 lg:row-start-2 ring-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">Record an expense</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Materials, transport, packaging, market runs, or labour.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => setShowForm((value) => !value)}
              >
                {showForm ? "Cancel" : "+ Add expense"}
              </Button>
            </div>
            {showForm && (
              <form
                onSubmit={submit}
                className="mt-5 grid gap-3 sm:grid-cols-[1fr_160px_160px_auto] sm:items-end"
              >
                <div>
                  <Label htmlFor="expense-label">What was it for?</Label>
                  <Input
                    id="expense-label"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="e.g. Market run"
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="expense-amount">Amount</Label>
                  <Input
                    id="expense-amount"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setExpenseError("");
                    }}
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 5,000"
                    className="mt-2"
                    required
                  />
                  {expenseError && (
                    <p role="alert" className="mt-1 text-sm text-rose-800">
                      {expenseError}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="expense-date">Date</Label>
                  <Input
                    id="expense-date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    type="date"
                    className="mt-2"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-stone-950 text-white hover:bg-stone-700"
                >
                  {isSaving ? "Saving…" : "Save expense"}
                </Button>
              </form>
            )}
            {expenses.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-stone-100 pt-4">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span>
                      <span className="block text-stone-600">
                        {expense.label}
                      </span>
                      <span className="block text-xs text-stone-400">
                        {dayLabel(expense.date)}
                      </span>
                    </span>
                    <span className="font-bold text-stone-950">
                      {fmt(expense.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <section
        aria-labelledby="account-actions-heading"
        className="mt-8 border-t border-stone-200 pt-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="account-actions-heading"
              className="text-sm font-semibold text-stone-950"
            >
              Account
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Sign out of this Studio workspace on this device.
            </p>
          </div>
          <SignOutButton />
        </div>
      </section>
    </>
  );
}

type ProfileProps = {
  today: string;
  businessLogo?: string;
  ownerName?: string;
  businessName?: string;
  onOwnerNameChange: (name: string) => void;
  onBusinessNameChange: (name: string) => void;
  onLogoChange: (logo?: string) => void;
  onSaveProfile: (profile: BusinessProfile) => Promise<void>;
  onSettings: () => void;
  onSummary: () => void;
  revenue: number;
  delivered: number;
  expenses: Expense[];
  onAddExpense: (expense: Expense) => Promise<void>;
};

function studioNavigate(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Profile({
  today,
  businessLogo,
  ownerName,
  businessName,
  onSettings,
  onSummary,
  revenue,
  delivered,
  expenses,
  onAddExpense,
  onSaveProfile,
}: ProfileProps) {
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [expenseError, setExpenseError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const displayBusinessName = businessName?.trim() || "Your business";
  const displayOwnerName = ownerName?.trim() || "Add your name";
  const logoStyle = businessLogo
    ? {
        backgroundImage: `url(${businessLogo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;
  useEffect(() => {
    const syncRoute = () =>
      setIsEditingRoute(window.location.pathname === "/profile/edit");
    const frame = window.requestAnimationFrame(syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const cleanLabel = label.trim();
    const numericAmount = parseMoneyInput(amount);
    if (!cleanLabel || numericAmount === null || numericAmount <= 0 || !date) {
      setExpenseError("Enter a valid amount, such as 5,000.");
      return;
    }
    setExpenseError("");
    setIsSaving(true);
    await onAddExpense({
      id: `e${Date.now()}`,
      label: cleanLabel,
      amount: numericAmount,
      date,
    });
    setLabel("");
    setAmount("");
    setDate(today);
    setShowForm(false);
    setIsSaving(false);
  };
  if (isEditingRoute)
    return (
      <ProfileEditor
        businessLogo={businessLogo}
        ownerName={ownerName}
        businessName={businessName}
        onSaveProfile={onSaveProfile}
        onCancel={() => studioNavigate("/profile")}
      />
    );
  return (
    <>
      <PageHeader
        title="Profile"
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onSettings}
            aria-label="Open settings"
            title="Settings"
          >
            <Settings2 className="h-5 w-5" aria-hidden="true" />
          </Button>
        }
      />
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
        <Card className="lg:col-start-1 lg:row-start-1 ring-0">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => studioNavigate("/profile/edit")}
              aria-label="Edit business profile"
              className="block w-full rounded-xl p-5 text-left transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    role="img"
                    aria-label={
                      businessLogo
                        ? "Business image"
                        : "Business image not added"
                    }
                    className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-brand"
                    style={logoStyle}
                  >
                    {!businessLogo &&
                      (businessName || ownerName ? (
                        <span className="text-xl font-bold">
                          {initials(businessName || ownerName)}
                        </span>
                      ) : (
                        <ImageIcon className="h-7 w-7" aria-hidden="true" />
                      ))}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-500">
                      Business profile
                    </p>
                    <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-stone-950">
                      {displayBusinessName}
                    </h2>
                    <p className="mt-1 truncate text-sm text-stone-600">
                      {displayOwnerName}
                    </p>
                  </div>
                </div>
                <Pencil
                  className="h-4 w-4 shrink-0 text-stone-400"
                  aria-hidden="true"
                />
              </div>
            </button>
          </CardContent>
        </Card>
        <Button
          type="button"
          variant="outline"
          onClick={onSummary}
          aria-label="Open business summary"
          className="order-2 h-full min-h-44 w-full items-start justify-between rounded-xl border-stone-200 bg-white p-5 text-left whitespace-normal hover:bg-mist lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <span className="block min-w-0 flex-1">
            <span className="block text-base font-semibold text-stone-950">
              Business summary
            </span>
            <span className="mt-1 block text-sm leading-5 text-stone-500">
              Review monthly profit, expenses, and the orders that made them.
            </span>
            <span className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-200 pt-3">
              <span>
                <span className="block text-[11px] font-semibold text-stone-500">
                  Revenue
                </span>
                <span className="mt-1 block truncate text-sm font-bold text-stone-950">
                  {fmt(revenue)}
                </span>
              </span>
              <span>
                <span className="block text-[11px] font-semibold text-stone-500">
                  Expenses
                </span>
                <span className="mt-1 block truncate text-sm font-bold text-stone-950">
                  {fmt(totalExpenses)}
                </span>
              </span>
              <span>
                <span className="block text-[11px] font-semibold text-stone-500">
                  Delivered
                </span>
                <span className="mt-1 block text-sm font-bold text-stone-950">
                  {delivered}
                </span>
              </span>
            </span>
          </span>
          <ChevronRight
            className="mt-1 h-5 w-5 shrink-0 text-stone-400"
            aria-hidden="true"
          />
        </Button>
        <Card className="order-3 lg:col-start-1 lg:row-start-2 ring-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">Record an expense</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Materials, transport, packaging, market runs, or labour.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => setShowForm((value) => !value)}
              >
                {showForm ? "Cancel" : "+ Add expense"}
              </Button>
            </div>
            {showForm && (
              <form
                onSubmit={submit}
                className="mt-5 grid gap-3 sm:grid-cols-[1fr_160px_160px_auto] sm:items-end"
              >
                <div>
                  <Label htmlFor="expense-label">What was it for?</Label>
                  <Input
                    id="expense-label"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="e.g. Market run"
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="expense-amount">Amount</Label>
                  <Input
                    id="expense-amount"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setExpenseError("");
                    }}
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 5,000"
                    className="mt-2"
                    required
                  />
                  {expenseError && (
                    <p role="alert" className="mt-1 text-sm text-rose-800">
                      {expenseError}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="expense-date">Date</Label>
                  <Input
                    id="expense-date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    type="date"
                    className="mt-2"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-stone-950 text-white hover:bg-stone-700"
                >
                  {isSaving ? "Saving…" : "Save expense"}
                </Button>
              </form>
            )}
            {expenses.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-stone-100 pt-4">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span>
                      <span className="block text-stone-600">
                        {expense.label}
                      </span>
                      <span className="block text-xs text-stone-400">
                        {dayLabel(expense.date)}
                      </span>
                    </span>
                    <span className="font-bold text-stone-950">
                      {fmt(expense.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <section
        aria-labelledby="account-actions-heading"
        className="mt-8 border-t border-stone-200 pt-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="account-actions-heading"
              className="text-sm font-semibold text-stone-950"
            >
              Account
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Sign out of this Studio workspace on this device.
            </p>
          </div>
          <SignOutButton />
        </div>
      </section>
    </>
  );
}

function ProfileEditor({
  businessLogo,
  ownerName,
  businessName,
  onSaveProfile,
  onCancel,
}: {
  businessLogo?: string;
  ownerName?: string;
  businessName?: string;
  onSaveProfile: (profile: BusinessProfile) => Promise<void>;
  onCancel: () => void;
}) {
  const [draftOwnerName, setDraftOwnerName] = useState(ownerName ?? "");
  const [draftBusinessName, setDraftBusinessName] = useState(
    businessName ?? "",
  );
  const [draftLogo, setDraftLogo] = useState(businessLogo);
  const [logoError, setLogoError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const logoStyle = draftLogo
    ? {
        backgroundImage: `url(${draftLogo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;
  const handleLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Choose an image file for your business logo.");
      input.value = "";
      return;
    }
    if (isUploadingLogo) return;
    setIsUploadingLogo(true);
    setLogoError("");
    try {
      setDraftLogo(await uploadImage(file, "logos"));
    } catch (uploadError) {
      setLogoError(
        uploadError instanceof Error
          ? uploadError.message
          : "The image upload failed. Try again.",
      );
    } finally {
      setIsUploadingLogo(false);
      input.value = "";
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || isUploadingLogo) return;
    setIsSaving(true);
    setLogoError("");
    try {
      await onSaveProfile({
        logo: draftLogo,
        ownerName: draftOwnerName,
        businessName: draftBusinessName,
      });
      onCancel();
    } catch (saveError) {
      setLogoError(
        saveError instanceof Error
          ? saveError.message
          : "Your profile could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="Edit profile"
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="gap-2 text-stone-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Button>
        }
      />
      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <Card className="ring-0">
          <CardContent className="space-y-5 p-5">
            <div>
              <h2 className="text-lg font-semibold text-stone-950">
                Business identity
              </h2>
              <p className="mt-1 text-sm leading-5 text-stone-500">
                Update the name and image people will see for this workspace.
              </p>
            </div>
            <div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                aria-hidden="true"
                tabIndex={-1}
                className="sr-only"
                onChange={handleLogo}
                disabled={isUploadingLogo}
              />
              <Button
                type="button"
                variant="outline"
                aria-label={draftLogo ? "Change business image" : "Add business image"}
                onClick={() => logoInputRef.current?.click()}
                disabled={isUploadingLogo}
                className="h-auto min-h-24 w-full justify-start gap-4 whitespace-normal rounded-xl border-dashed border-stone-200 bg-stone-50 p-4 text-left hover:border-teal-300 hover:bg-brand-soft"
              >
                <div
                  role="img"
                  aria-label={
                    draftLogo
                      ? "Business logo preview"
                      : "No business logo selected"
                  }
                  className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-brand"
                  style={logoStyle}
                >
                  {!draftLogo && (
                    <ImageIcon className="h-7 w-7" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-950">
                    Business image
                  </p>
                  <p className="mt-1 text-sm leading-5 text-stone-500">
                    Optional. Studio compresses the image before uploading it.
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                    {isUploadingLogo
                      ? "Uploading…"
                      : draftLogo
                        ? "Change image"
                        : "Add image"}
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="business-name">Business name</Label>
                <Input
                  id="business-name"
                  value={draftBusinessName}
                  onChange={(event) => setDraftBusinessName(event.target.value)}
                  placeholder="e.g. Studio by Jutin"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="owner-name">Your name</Label>
                <Input
                  id="owner-name"
                  value={draftOwnerName}
                  onChange={(event) => setDraftOwnerName(event.target.value)}
                  placeholder="Your name"
                  className="mt-2"
                />
              </div>
            </div>
            {logoError && (
              <p
                role="alert"
                className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
              >
                {logoError}
              </p>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving || isUploadingLogo}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving || isUploadingLogo}
            className="bg-stone-950 text-white hover:bg-stone-700"
          >
            {isSaving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </>
  );
}

function SettingsPanel({
  settings,
  onSave,
  onBack,
}: {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onBack: () => void;
}) {
  const [workingDays, setWorkingDays] = useState(String(settings.workingDays));
  const [reminderTime, setReminderTime] = useState(settings.reminderTime);
  const [attentionDaysBefore, setAttentionDaysBefore] = useState(String(settings.attentionDaysBefore));
  const [dueSoonDaysBefore, setDueSoonDaysBefore] = useState(settings.dueSoonDaysBefore);
  const [customReminderDay, setCustomReminderDay] = useState("");
  const [overdueGraceDays, setOverdueGraceDays] = useState(String(settings.overdueGraceDays));
  const [overdueRepeatDays, setOverdueRepeatDays] = useState(String(settings.overdueRepeatDays));
  const [stalledRemindersEnabled, setStalledRemindersEnabled] = useState(settings.stalledRemindersEnabled);
  const [stalledAfterDays, setStalledAfterDays] = useState(String(settings.stalledAfterDays));
  const [stalledRepeatDays, setStalledRepeatDays] = useState(String(settings.stalledRepeatDays));
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const days = Number(workingDays);
    const attentionDays = Number(attentionDaysBefore);
    const overdueGrace = Number(overdueGraceDays);
    const overdueRepeat = Number(overdueRepeatDays);
    const stalledAfter = Number(stalledAfterDays);
    const stalledRepeat = Number(stalledRepeatDays);
    if (!Number.isInteger(days) || days < 1 || days > 31) {
      setError("Business days per order must be between 1 and 31.");
      return;
    }
    if (!Number.isInteger(attentionDays) || attentionDays < 1 || attentionDays > 30) {
      setError("The Needs attention window must be between 1 and 30 days.");
      return;
    }
    if (dueSoonDaysBefore.length > 10 || dueSoonDaysBefore.some((day) => !Number.isInteger(day) || day < 1 || day > 30)) {
      setError("Choose up to 10 reminder days, each from 1 to 30 days before the due date.");
      return;
    }
    if (!Number.isInteger(overdueGrace) || overdueGrace < 0 || overdueGrace > 14 || !Number.isInteger(overdueRepeat) || overdueRepeat < 1 || overdueRepeat > 30) {
      setError("Overdue wait must be 0–14 days and its repeat interval must be 1–30 days.");
      return;
    }
    if (!Number.isInteger(stalledAfter) || stalledAfter < 1 || stalledAfter > 30 || !Number.isInteger(stalledRepeat) || stalledRepeat < 1 || stalledRepeat > 30) {
      setError("Stalled-order timing must be between 1 and 30 days.");
      return;
    }
    const selectedTimeZone = resolveDeviceTimeZone(settings.timeZone);
    setIsSaving(true);
    setError("");
    const nextSettings: Settings = {
      workingDays: days,
      reminderTime,
      timeZone: selectedTimeZone,
      attentionDaysBefore: attentionDays,
      dueSoonDaysBefore: [...dueSoonDaysBefore].sort((a, b) => b - a),
      overdueGraceDays: overdueGrace,
      overdueRepeatDays: overdueRepeat,
      stalledRemindersEnabled,
      stalledAfterDays: stalledAfter,
      stalledRepeatDays: stalledRepeat,
    };
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nextSettings,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error ?? "Settings could not be saved.");
      }
      onSave(nextSettings);
      setWorkingDays(String(days));
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Settings could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Your setup"
        title="Settings"
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="gap-2 text-stone-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Button>
        }
      />
      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <Card className="ring-0">
          <CardContent className="space-y-5 p-5">
            <div>
              <Label htmlFor="working-days">Business days per order</Label>
              <Input
                id="working-days"
                type="number"
                min="1"
                max="31"
                value={workingDays}
                onChange={(event) => {
                  setWorkingDays(event.target.value);
                  setSaved(false);
                }}
                className="mt-2 h-11"
              />
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Studio uses this preference to help you choose realistic due
                dates.
              </p>
            </div>
            <div>
              <Label htmlFor="reminder-time">Daily order alert time</Label>
              <Input
                required
                id="reminder-time"
                type="time"
                value={reminderTime}
                onChange={(event) => {
                  setReminderTime(event.target.value);
                  setSaved(false);
                }}
                className="mt-2 h-11"
              />
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Reminders use this device’s local time and send only when an order matches
                your rules. Checks run about once a minute; the default is 9:00 AM. Saving
                Settings on another device switches the account to that device’s local time.
              </p>
            </div>
            <div className="border-t border-stone-100 pt-5">
              <h2 className="text-sm font-semibold text-stone-950">Needs attention</h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Choose how early upcoming orders appear on your home screen and in the Due soon filter. This is separate from push timing.
              </p>
              <div className="mt-3 max-w-xs">
                <Label htmlFor="attention-days-before">Show orders this many days before they&apos;re due</Label>
                <Input
                  id="attention-days-before"
                  type="number"
                  min="1"
                  max="30"
                  value={attentionDaysBefore}
                  onChange={(event) => { setAttentionDaysBefore(event.target.value); setSaved(false); }}
                  className="mt-2 h-11"
                />
                <p className="mt-1 text-xs text-stone-500">Calendar days; default is 3. Overdue orders always remain visible.</p>
              </div>
            </div>
            <div className="border-t border-stone-100 pt-5">
              <h2 className="text-sm font-semibold text-stone-950">Push reminder timing</h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Choose calendar days before a due date for individual reminders. The default is 3 and 2 days; the due-date reminder is controlled separately below.
              </p>
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Reminder days before due date">
                {[1, 2, 3, 5, 7, 14].map((day) => {
                  const selected = dueSoonDaysBefore.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setDueSoonDaysBefore((current) => selected ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => b - a));
                        setSaved(false);
                      }}
                      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${selected ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"}`}
                    >
                      {day} day{day === 1 ? "" : "s"} before
                    </button>
                  );
                })}
                {dueSoonDaysBefore.filter((day) => ![1, 2, 3, 5, 7, 14].includes(day)).map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed="true"
                    onClick={() => { setDueSoonDaysBefore((current) => current.filter((value) => value !== day)); setSaved(false); }}
                    className="min-h-11 rounded-full border border-stone-950 bg-stone-950 px-4 text-sm font-semibold text-white"
                  >
                    {day} days before <span aria-hidden="true">×</span><span className="sr-only">, remove reminder day</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="w-full sm:max-w-44">
                  <Label htmlFor="custom-reminder-day">Add a custom reminder day</Label>
                  <Input
                    id="custom-reminder-day"
                    type="number"
                    min="1"
                    max="30"
                    value={customReminderDay}
                    onChange={(event) => setCustomReminderDay(event.target.value)}
                    className="mt-2 h-11"
                    placeholder="1–30 days"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={!Number.isInteger(Number(customReminderDay)) || Number(customReminderDay) < 1 || Number(customReminderDay) > 30 || dueSoonDaysBefore.includes(Number(customReminderDay)) || dueSoonDaysBefore.length >= 10}
                  onClick={() => {
                    setDueSoonDaysBefore((current) => [...current, Number(customReminderDay)].sort((a, b) => b - a));
                    setCustomReminderDay("");
                    setSaved(false);
                  }}
                >
                  Add day
                </Button>
              </div>
              {dueSoonDaysBefore.length === 0 && <p className="mt-2 text-xs text-stone-500">No pre-due push days selected. Due-date and overdue alerts can still be sent.</p>}
            </div>
            <div className="border-t border-stone-100 pt-5">
              <h2 className="text-sm font-semibold text-stone-950">Overdue follow-up</h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">After this calendar-day grace period, an order is marked overdue. Push alerts then repeat until delivery, if Overdue notifications are on. Deadline alerts are not snoozed.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="overdue-grace-days">Grace period after due date (days)</Label>
                  <Input id="overdue-grace-days" type="number" min="0" max="14" value={overdueGraceDays} onChange={(event) => { setOverdueGraceDays(event.target.value); setSaved(false); }} className="mt-2 h-11" />
                  <p className="mt-1 text-xs text-stone-500">0 means it is marked overdue the day after the due date.</p>
                </div>
                <div>
                  <Label htmlFor="overdue-repeat-days">Repeat every (calendar days)</Label>
                  <Input id="overdue-repeat-days" type="number" min="1" max="30" value={overdueRepeatDays} onChange={(event) => { setOverdueRepeatDays(event.target.value); setSaved(false); }} className="mt-2 h-11" />
                </div>
              </div>
            </div>
            <div className="border-t border-stone-100 pt-5">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={stalledRemindersEnabled} onCheckedChange={(checked) => { setStalledRemindersEnabled(checked === true); setSaved(false); }} />
                <span>
                  <span className="block text-sm font-semibold text-stone-950">Nudge me about stalled orders</span>
                  <span className="mt-1 block text-xs leading-5 text-stone-500">Optional reminders for not-started or in-progress orders that have not been updated, using calendar days.</span>
                </span>
              </label>
              {stalledRemindersEnabled && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="stalled-after-days">Nudge after no update for (days)</Label>
                    <Input id="stalled-after-days" type="number" min="1" max="30" value={stalledAfterDays} onChange={(event) => { setStalledAfterDays(event.target.value); setSaved(false); }} className="mt-2 h-11" />
                  </div>
                  <div>
                    <Label htmlFor="stalled-repeat-days">Repeat every (days)</Label>
                    <Input id="stalled-repeat-days" type="number" min="1" max="30" value={stalledRepeatDays} onChange={(event) => { setStalledRepeatDays(event.target.value); setSaved(false); }} className="mt-2 h-11" />
                  </div>
                  <p className="text-xs leading-5 text-stone-500 sm:col-span-2">Updating an order&apos;s status or details restarts its no-update timer. Delivered and ready orders do not get stalled nudges.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
          >
            {error}
          </p>
        )}
        {saved && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
          >
            Settings saved.
          </p>
        )}
        <Button
          type="submit"
          disabled={isSaving}
          className="bg-stone-950 text-white hover:bg-stone-700"
        >
          {isSaving ? "Saving…" : "Save settings"}
        </Button>
      </form>
      <div className="mt-6 max-w-2xl">
        <PushNotificationSettings dueSoonDaysBefore={dueSoonDaysBefore} />
      </div>
      <ReceiptSettingsPanel />
    </>
  );
}

function OrderDetail({
  order,
  advance,
  onSave,
  onDelete,
  close,
}: {
  order: Order;
  advance: (id: string) => void;
  onSave: (order: Order) => Promise<boolean>;
  onDelete: (order: Order) => Promise<boolean>;
  close: () => void;
}) {
  const nextAction: Partial<Record<Status, string>> = {
    not_started: "Start order",
    in_progress: "Mark ready",
    ready: "Mark delivered",
  };
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [customer, setCustomer] = useState(order.customer);
  const [product, setProduct] = useState(order.product);
  const [amount, setAmount] = useState(String(order.total));
  const [dueDate, setDueDate] = useState(order.dueDate ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const syncLabel =
    order.synced === false
      ? "Saved on this device · Sync pending"
      : "Saved to your account";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextAmount = parseMoneyInput(amount);
    if (
      !customer.trim() ||
      !product.trim() ||
      nextAmount === null ||
      nextAmount <= 0 ||
      !dueDate
    ) {
      setError("Add a customer, product, paid amount, and due date.");
      return;
    }
    setIsSaving(true);
    setError("");
    const saved = await onSave({
      ...order,
      customer: customer.trim(),
      product: product.trim(),
      total: nextAmount,
      dueDate,
      due: dueLabelForDate(dueDate, dateKey(new Date())),
      notes: notes.trim(),
    });
    setIsSaving(false);
    if (saved) setEditing(false);
    else
      setError(
        "The order could not be saved. Check your connection and try again.",
      );
  };
  const remove = async () => {
    setIsDeleting(true);
    setError("");
    try {
      const deleted = await onDelete(order);
      if (!deleted) {
        setError(
          "We couldn't confirm the deletion. Refresh Orders to check its status before trying again.",
        );
      }
    } catch {
      setError(
        "We couldn't confirm the deletion. Refresh Orders to check its status before trying again.",
      );
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <>
    {showReceipt && (
      <ReceiptDialog
        order={{ id: order.id, customer: order.customer, product: order.product, total: order.total }}
        close={() => setShowReceipt(false)}
      />
    )}
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-bold text-stone-950">
              {editing ? "Edit order" : order.customer}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-stone-500">
              {editing
                ? "Correct the details for this paid order."
                : "Paid order details and progress."}
            </DialogDescription>
          </div>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close order details"
              />
            }
          >
            <X />
          </DialogClose>
        </div>
        {editing ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="edit-customer">Customer name</Label>
              <Input
                id="edit-customer"
                maxLength={160}
                value={customer}
                onChange={(event) => setCustomer(event.target.value)}
                className="mt-2 h-11"
              />
            </div>
            <div>
              <Label htmlFor="edit-product">Product</Label>
              <Input
                id="edit-product"
                maxLength={160}
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                className="mt-2 h-11"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-amount">Amount paid</Label>
                <Input
                  id="edit-amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  type="text"
                  inputMode="decimal"
                  className="mt-2 h-11"
                />
              </div>
              <div>
                <Label htmlFor="edit-due-date">Due date</Label>
                <Input
                  id="edit-due-date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  type="date"
                  className="mt-2 h-11"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-brand text-white hover:bg-teal-800"
              >
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : confirmDelete ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              <p className="font-semibold">Delete this order?</p>
              <p className="mt-1">
                This removes the paid order and its reminders from your account.
                This cannot be undone.
              </p>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("");
                  setConfirmDelete(false);
                }}
                disabled={isDeleting}
              >
                Keep order
              </Button>
              <Button
                type="button"
                onClick={() => void remove()}
                disabled={isDeleting}
                className="bg-rose-700 text-white hover:bg-rose-800"
              >
                {isDeleting ? "Deleting…" : "Delete order"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 rounded-xl bg-stone-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-500">Customer</span>
                <span className="font-semibold text-stone-950">
                  {order.customer}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-500">Product</span>
                <span className="font-semibold text-stone-950">
                  {order.product}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-500">Due</span>
                <span className="font-semibold text-stone-950">
                  {order.due}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-500">Paid</span>
                <span className="font-semibold text-stone-950">
                  {fmt(order.total)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-500">Status</span>
                <StatusBadge status={order.status} />
              </div>
            </div>
            {order.notes && (
              <p className="mt-4 text-sm text-stone-600">{order.notes}</p>
            )}
            <p
              role="status"
              className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${order.synced === false ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
            >
              {syncLabel}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              {isUuid(order.id) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowReceipt(true)}
                >
                  Receipt
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("");
                  setConfirmDelete(true);
                }}
                className="text-rose-700 hover:bg-rose-50"
              >
                Delete
              </Button>
              {order.synced === false && (
                <Button
                  type="button"
                  onClick={() => void onSave(order)}
                  className="bg-brand text-white hover:bg-teal-800"
                >
                  Retry sync
                </Button>
              )}
              {order.status !== "delivered" && (
                <Button
                  type="button"
                  onClick={() => {
                    advance(order.id);
                    close();
                  }}
                  className="bg-stone-950 text-white hover:bg-stone-700"
                >
                  {nextAction[order.status]}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

function OrderManagement({
  today,
  orders,
  attentionDaysBefore,
  overdueGraceDays,
  filter,
  setFilter,
  advance,
  goAdd,
  selectOrder,
}: {
  today: string;
  orders: Order[];
  attentionDaysBefore: number;
  overdueGraceDays: number;
  filter: "all" | Status;
  setFilter: (value: "all" | Status) => void;
  advance: (id: string) => void;
  goAdd: () => void;
  selectOrder: (order: Order) => void;
}) {
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const filters: { id: "all" | Status; label: string }[] = [
    { id: "all", label: "All" },
    { id: "not_started", label: "Not started" },
    { id: "in_progress", label: "In progress" },
    { id: "ready", label: "Ready" },
    { id: "delivered", label: "Delivered" },
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const products = useMemo(
    () =>
      [...new Set(orders.map((order) => order.product))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [orders],
  );
  const customers = useMemo(
    () =>
      [...new Set(orders.map((order) => order.customer))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [orders],
  );
  const filteredOrders = useMemo(
    () =>
      orders
        .filter((order) => {
          const dueDate = order.dueDate ?? "";
          const dateMatches =
            dateFilter === "all" ||
            (dateFilter === "today" && dueDate === today) ||
            (dateFilter === "due_soon" &&
              dueDate > today &&
              dueDate <= addCalendarDays(today, attentionDaysBefore)) ||
            (dateFilter === "overdue" &&
              isOverdueDate(dueDate, today, overdueGraceDays) &&
              order.status !== "delivered");
          return (
            (filter === "all" || order.status === filter) &&
            dateMatches &&
            (productFilter === "all" || order.product === productFilter) &&
            (customerFilter === "all" || order.customer === customerFilter) &&
            (!normalizedQuery ||
              `${order.customer} ${order.product}`
                .toLowerCase()
                .includes(normalizedQuery))
          );
        })
        .sort((a, b) => {
          const rank = (order: Order) =>
            isOverdueDate(order.dueDate, today, overdueGraceDays) &&
            order.status !== "delivered"
              ? -1
              : order.due === "Today"
                ? 0
                : order.due === "Tomorrow"
                  ? 1
                  : order.status === "delivered"
                    ? 3
                    : 2;
          return rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt);
        }),
    [
      orders,
      attentionDaysBefore,
      overdueGraceDays,
      filter,
      dateFilter,
      productFilter,
      customerFilter,
      normalizedQuery,
      today,
    ],
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = [
    dateFilter !== "all",
    productFilter !== "all",
    customerFilter !== "all",
  ].filter(Boolean).length;
  const hasFilters = Boolean(
    normalizedQuery ||
      dateFilter !== "all" ||
      productFilter !== "all" ||
      customerFilter !== "all" ||
      filter !== "all",
  );
  const clearScopedFilters = () => {
    setDateFilter("all");
    setProductFilter("all");
    setCustomerFilter("all");
  };
  const clearFilters = () => {
    setQuery("");
    setDateFilter("all");
    setProductFilter("all");
    setCustomerFilter("all");
    setFilter("all");
  };
  return (
    <>
      <PageHeader
        eyebrow="Order tracker"
        title="Orders"
        action={
          <Button
            onClick={() => goAdd()}
            className="bg-stone-950 text-white hover:bg-stone-700"
          >
            <Plus className="h-4 w-4" />
            Order
          </Button>
        }
      />
      <section aria-label="Order management" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer, product, or order ID"
              aria-label="Search orders"
              className="h-11 pl-9"
            />
          </div>
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as "all" | Status)}
            className="min-w-0"
          >
            <TabsList className="flex w-full justify-start overflow-x-auto rounded-lg bg-muted p-1 sm:w-auto">
              <TabsTrigger
                value="all"
                className="whitespace-nowrap rounded-md px-3"
              >
                All{" "}
                <span className="ml-1 text-xs text-stone-500">
                  {orders.length}
                </span>
              </TabsTrigger>
              {filters.slice(1).map((item) => (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="whitespace-nowrap rounded-md px-3"
                >
                  {item.label}{" "}
                  <span className="ml-1 text-xs text-stone-500">
                    {orders.filter((order) => order.status === item.id).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltersOpen(true)}
              aria-label={
                activeFilterCount
                  ? `Open filters, ${activeFilterCount} active`
                  : "Open filters"
              }
              className="h-11 shrink-0 gap-2"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-soft px-1.5 text-xs font-bold text-brand">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <DialogContent>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="text-xl font-bold text-stone-950">
                    Filter orders
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm text-stone-500">
                    Narrow paid orders by due date, product, or customer.
                  </DialogDescription>
                </div>
                <DialogClose
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Close filters"
                    >
                      <X />
                    </Button>
                  }
                />
              </div>
              <div className="mt-6 grid gap-4">
                <div>
                  <Label htmlFor="order-date-filter">Due date</Label>
                  <Select
                    value={dateFilter}
                    items={[
                      { value: "all", label: "All dates" },
                      { value: "today", label: "Due today" },
                      { value: "due_soon", label: "Due soon" },
                      { value: "overdue", label: "Overdue" },
                    ]}
                    onValueChange={(value) => setDateFilter(String(value))}
                  >
                    <SelectTrigger
                      id="order-date-filter"
                      className="mt-2 h-11 w-full"
                      aria-label="Filter orders by date"
                    >
                      <SelectValue placeholder="All dates" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All dates</SelectItem>
                      <SelectItem value="today">Due today</SelectItem>
                      <SelectItem value="due_soon">Due soon</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="order-product-filter">Product</Label>
                  <Select
                    value={productFilter}
                    items={[
                      { value: "all", label: "All products" },
                      ...products.map((product) => ({
                        value: product,
                        label: product,
                      })),
                    ]}
                    onValueChange={(value) => setProductFilter(String(value))}
                  >
                    <SelectTrigger
                      id="order-product-filter"
                      className="mt-2 h-11 w-full"
                      aria-label="Filter orders by product"
                    >
                      <SelectValue placeholder="All products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All products</SelectItem>
                      {products.map((product) => (
                        <SelectItem key={product} value={product}>
                          {product}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="order-customer-filter">Customer</Label>
                  <Select
                    value={customerFilter}
                    items={[
                      { value: "all", label: "All customers" },
                      ...customers.map((customer) => ({
                        value: customer,
                        label: customer,
                      })),
                    ]}
                    onValueChange={(value) => setCustomerFilter(String(value))}
                  >
                    <SelectTrigger
                      id="order-customer-filter"
                      className="mt-2 h-11 w-full"
                      aria-label="Filter orders by customer"
                    >
                      <SelectValue placeholder="All customers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All customers</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer} value={customer}>
                          {customer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearScopedFilters}
                  disabled={activeFilterCount === 0}
                >
                  Clear filters
                </Button>
                <DialogClose
                  render={
                    <Button
                      type="button"
                      className="bg-stone-950 text-white hover:bg-stone-700"
                    >
                      Done
                    </Button>
                  }
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <p aria-live="polite">
            {filteredOrders.length} paid order
            {filteredOrders.length === 1 ? "" : "s"}
            {normalizedQuery ? ` matching “${query.trim()}”` : ""}
          </p>
          <div className="flex items-center gap-3">
            <p>Delivered orders remain in history</p>
            {hasFilters && (
              <Button
                type="button"
                variant="link"
                onClick={clearFilters}
                className="h-auto p-0 text-brand"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
        <Card className="px-4 ring-0">
          <CardContent className="p-0">
            {filteredOrders.length ? (
              filteredOrders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  today={today}
                  overdueGraceDays={overdueGraceDays}
                  advance={advance}
                  onSelect={selectOrder}
                />
              ))
            ) : (
              <div className="py-14 text-center">
                <p className="font-semibold text-stone-950">
                  No orders match this view.
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Try another filter or add a confirmed paid order.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {hasFilters && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => goAdd()}
                    className="bg-stone-950 text-white hover:bg-stone-700"
                  >
                    <Plus className="h-4 w-4" />
                    Order
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
