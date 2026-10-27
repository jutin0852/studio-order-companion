"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextActionLabel, statusLabel } from "./constants";
import { dayKey, dayLabel, fmt, isOverdueDate } from "./format";
import type { Order } from "./types";
import { StatusBadge } from "./ui";

export function OrderRow({
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

export function SummaryOrderRow({
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
