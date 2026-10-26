"use client";

import { useMemo, useState } from "react";
import { Filter, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { addCalendarDays, isOverdueDate } from "./format";
import { OrderRow } from "./order-rows";
import type { Order, Status } from "./types";
import { PageHeader } from "./ui";

export function OrderManagement({
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
