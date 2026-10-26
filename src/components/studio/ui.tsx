"use client";

import type { ReactNode } from "react";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { statusLabel, statusStyle } from "./constants";
import type { Status } from "./types";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <UiBadge
      variant="secondary"
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[status]}`}
    >
      {statusLabel[status]}
    </UiBadge>
  );
}

export function PageHeader({
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

export function Metric({
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
