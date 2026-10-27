"use client";

import { Bell, LoaderCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PushPromptState } from "./push-prompt-state";

export function PushPrompt({
  state,
  busy,
  error,
  onEnable,
  onDismiss,
}: {
  state: Exclude<PushPromptState, "hidden">;
  busy: boolean;
  error: string;
  onEnable: () => void;
  onDismiss: () => void;
}) {
  const installTip = state === "ios-install";
  const Icon = installTip ? Smartphone : Bell;
  return (
    <Card className="mb-5 ring-0" role="region" aria-labelledby="push-prompt-title">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="push-prompt-title" className="text-base font-bold text-stone-950">
              {installTip ? "Add Studio to your Home Screen" : "Never miss a due date"}
            </h2>
            <p className="mt-1 text-sm leading-5 text-stone-500">
              {installTip
                ? "On iPhone, reminders work once Studio is on your Home Screen. Tap the Share button, then Add to Home Screen."
                : "Turn on notifications and Studio will remind you about orders that need you, even when the app is closed."}
            </p>
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {!installTip && (
            <Button type="button" onClick={onEnable} disabled={busy} className="bg-stone-950 text-white hover:bg-stone-700">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
              Turn on notifications
            </Button>
          )}
          <Button type="button" variant={installTip ? "default" : "ghost"} onClick={onDismiss} className={installTip ? "bg-stone-950 text-white hover:bg-stone-700" : "text-stone-500"}>
            {installTip ? "Got it" : "Not now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
