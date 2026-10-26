"use client";

import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { nextActionLabel, statusLabel, statusStyle } from "./constants";
import { dateHeading, dueAttentionLabel } from "./format";
import { OrderRow } from "./order-rows";
import type { Order } from "./types";
import { Metric, PageHeader } from "./ui";

export function Today({
  today,
  ownerName,
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
