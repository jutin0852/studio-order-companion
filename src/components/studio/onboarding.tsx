"use client";

import { Bell, Check, ClipboardList, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { completedSetupSteps, nextSetupStep, type SetupStep, type SetupStepId } from "./onboarding-steps";

export function SetupGuide({
  steps,
  onNavigate,
  onHide,
  onShowWelcome,
  inlineActions,
  busy = false,
  error = "",
}: {
  steps: SetupStep[];
  onNavigate: (href: string) => void;
  onHide: () => void;
  onShowWelcome: () => void;
  // Steps that can be finished right here instead of opening another screen.
  inlineActions?: Partial<Record<SetupStepId, () => void>>;
  busy?: boolean;
  error?: string;
}) {
  const done = completedSetupSteps(steps);
  const next = nextSetupStep(steps);
  return (
    <Card className="mb-5 ring-0" aria-labelledby="setup-guide-title" role="region">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="setup-guide-title" className="text-base font-bold text-stone-950">Get started with Studio</h2>
            <p className="mt-0.5 text-sm text-stone-500">{done} of {steps.length} done</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onHide} className="text-stone-500">
            Hide
          </Button>
        </div>
        <div
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          className="h-2 overflow-hidden rounded-full bg-stone-100"
        >
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        <ol className="divide-y divide-stone-100">
          {steps.map((step) => {
            const isNext = next?.id === step.id;
            return (
              <li key={step.id} className="flex items-center gap-3 py-3">
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${step.done ? "border-brand bg-brand text-white" : "border-stone-300 text-stone-400"}`}
                >
                  {step.done ? <Check className="h-4 w-4" /> : steps.indexOf(step) + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${step.done ? "text-stone-400 line-through" : "text-stone-950"}`}>
                    {step.title}
                    <span className="sr-only">{step.done ? " (done)" : ""}</span>
                  </p>
                  {!step.done && <p className="mt-0.5 text-xs leading-5 text-stone-500">{step.description}</p>}
                </div>
                {!step.done && (
                  <Button
                    type="button"
                    size="sm"
                    variant={isNext ? "default" : "outline"}
                    disabled={busy && Boolean(inlineActions?.[step.id])}
                    onClick={() => (inlineActions?.[step.id] ?? (() => onNavigate(step.href)))()}
                    className={isNext ? "bg-stone-950 text-white hover:bg-stone-700" : undefined}
                  >
                    {step.actionLabel}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>}
        <button type="button" onClick={onShowWelcome} className="text-xs font-semibold text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
          How does Studio work?
        </button>
      </CardContent>
    </Card>
  );
}

const welcomeSteps = [
  { icon: Package, title: "Add what you sell", body: "Save your products once, so adding an order takes seconds." },
  { icon: ClipboardList, title: "Record each order", body: "When a customer pays, add the order with its due date. Move it along as you work: not started, in progress, ready, delivered." },
  { icon: Bell, title: "Stay on track", body: "Studio reminds you about orders that need you, and you can send customers a receipt." },
];

export function WelcomeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogTitle className="text-xl font-bold text-stone-950">Welcome to Studio</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-stone-500">
          Keep track of every paid order and never miss a due date. Here&apos;s how it works.
        </DialogDescription>
        <ol className="mt-5 space-y-4">
          {welcomeSteps.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="flex gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-950">{index + 1}. {title}</p>
                <p className="mt-0.5 text-sm leading-5 text-stone-500">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={onClose} className="bg-stone-950 text-white hover:bg-stone-700">
            Set up my studio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
