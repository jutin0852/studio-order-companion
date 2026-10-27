"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusLabel } from "./constants";
import { dayKey, dayLabel, fmt, monthKey, monthLabel } from "./format";
import { SummaryOrderRow } from "./order-rows";
import type { Expense, Order, Status } from "./types";
import { PageHeader } from "./ui";

export function BusinessSummary({
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

export function SummaryOrderHistory({
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
