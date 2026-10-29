"use client";

import type { ElementType, FormEvent, ReactNode } from "react";
import { useState } from "react";
import { ArrowLeft, Bell, ChevronRight, Package, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PushNotificationSettings } from "@/components/studio/push-notification-settings";
import { ReceiptSettingsPanel } from "@/components/studio/receipt-settings";
import { resolveDeviceTimeZone } from "./format";
import type { Settings, View } from "./types";
import { PageHeader } from "./ui";

export const settingsPages: { view: View; title: string; description: string; icon: ElementType }[] = [
  { view: "settings_orders", title: "Orders", description: "Due dates and what shows on your home screen", icon: Package },
  { view: "settings_notifications", title: "Notifications", description: "When and how Studio reminds you", icon: Bell },
  { view: "settings_receipts", title: "Receipts", description: "Your logo, colour and contact details", icon: ReceiptText },
];

export function SettingsHome({ onOpen, onBack }: { onOpen: (view: View) => void; onBack: () => void }) {
  return (
    <>
      <PageHeader
        eyebrow="Your setup"
        title="Settings"
        action={
          <Button type="button" variant="ghost" onClick={onBack} className="gap-2 text-stone-600">
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Button>
        }
      />
      <Card className="max-w-2xl ring-0">
        <CardContent className="divide-y divide-stone-100 p-0">
          {settingsPages.map(({ view, title, description, icon: Icon }) => (
            <button
              key={view}
              type="button"
              onClick={() => onOpen(view)}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-stone-950">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-stone-500">{description}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-stone-400" aria-hidden="true" />
            </button>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

export function SettingsSubpage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title={title}
        action={
          <Button type="button" variant="ghost" onClick={onBack} className="gap-2 text-stone-600">
            <ArrowLeft className="h-4 w-4" />
            Settings
          </Button>
        }
      />
      {children}
    </>
  );
}

export function ReceiptsSettingsPage({ onBack }: { onBack: () => void }) {
  return (
    <SettingsSubpage title="Receipts" onBack={onBack}>
      <ReceiptSettingsPanel />
    </SettingsSubpage>
  );
}

export function SettingsPanel({
  section,
  settings,
  notificationsPaused = false,
  onSave,
  onBack,
}: {
  section: "orders" | "notifications";
  settings: Settings;
  notificationsPaused?: boolean;
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
  const reminderDayChoices = [1, 2, 3, 5, 7, 14];
  const formFooter = (
    <>
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          Saved.
        </p>
      )}
      <Button type="submit" disabled={isSaving} className="bg-stone-950 text-white hover:bg-stone-700">
        {isSaving ? "Saving…" : "Save"}
      </Button>
    </>
  );
  if (section === "orders") {
    return (
      <SettingsSubpage title="Orders" onBack={onBack}>
        <form onSubmit={submit} className="max-w-2xl space-y-6">
          <Card className="ring-0">
            <CardContent className="space-y-5 p-5">
              <div>
                <Label htmlFor="working-days">Usual days to finish an order</Label>
                <Input
                  id="working-days"
                  type="number"
                  min="1"
                  max="31"
                  value={workingDays}
                  onChange={(event) => { setWorkingDays(event.target.value); setSaved(false); }}
                  className="mt-2 h-11"
                />
                <p className="mt-1 text-xs leading-5 text-stone-500">Working days you normally need. We use it to suggest due dates.</p>
              </div>
              <div>
                <Label htmlFor="attention-days-before">Flag orders due within (days)</Label>
                <Input
                  id="attention-days-before"
                  type="number"
                  min="1"
                  max="30"
                  value={attentionDaysBefore}
                  onChange={(event) => { setAttentionDaysBefore(event.target.value); setSaved(false); }}
                  className="mt-2 h-11"
                />
                <p className="mt-1 text-xs leading-5 text-stone-500">These show under &quot;Needs attention&quot; on your home screen. Late orders always show.</p>
              </div>
            </CardContent>
          </Card>
          {formFooter}
        </form>
      </SettingsSubpage>
    );
  }
  return (
    <SettingsSubpage title="Notifications" onBack={onBack}>
      <div className="max-w-2xl space-y-6">
        <PushNotificationSettings dueSoonDaysBefore={dueSoonDaysBefore} paused={notificationsPaused} />
        <form onSubmit={submit} className="space-y-6">
          <Card className="ring-0">
            <CardContent className="space-y-5 p-5">
              <div>
                <Label htmlFor="reminder-time">Daily reminder time</Label>
                <Input
                  required
                  id="reminder-time"
                  type="time"
                  value={reminderTime}
                  onChange={(event) => { setReminderTime(event.target.value); setSaved(false); }}
                  className="mt-2 h-11"
                />
                <p className="mt-1 text-xs leading-5 text-stone-500">Your reminder arrives at this time each day, using this device&apos;s clock.</p>
              </div>
              <details className="group rounded-xl border border-stone-200">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-stone-950">
                  More reminder options
                  <ChevronRight className="h-4 w-4 text-stone-400 transition-transform group-open:rotate-90" aria-hidden="true" />
                </summary>
                <div className="space-y-6 border-t border-stone-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-950">Heads-up before the due date</h3>
                    <p className="mt-1 text-xs leading-5 text-stone-500">Pick how many days ahead you want a reminder.</p>
                    <div className="mt-3 flex flex-wrap gap-2" aria-label="Reminder days before due date">
                      {[...new Set([...reminderDayChoices, ...dueSoonDaysBefore])].sort((a, b) => a - b).map((day) => {
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
                            {day} day{day === 1 ? "" : "s"}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="w-full sm:max-w-44">
                        <Label htmlFor="custom-reminder-day">Another number of days</Label>
                        <Input
                          id="custom-reminder-day"
                          type="number"
                          min="1"
                          max="30"
                          value={customReminderDay}
                          onChange={(event) => setCustomReminderDay(event.target.value)}
                          className="mt-2 h-11"
                          placeholder="1–30"
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
                        Add
                      </Button>
                    </div>
                  </div>
                  <div className="border-t border-stone-100 pt-5">
                    <h3 className="text-sm font-semibold text-stone-950">Late orders</h3>
                    <p className="mt-1 text-xs leading-5 text-stone-500">When an order is past its due date, we keep reminding you until it&apos;s delivered.</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="overdue-grace-days">Wait before calling it late (days)</Label>
                        <Input id="overdue-grace-days" type="number" min="0" max="14" value={overdueGraceDays} onChange={(event) => { setOverdueGraceDays(event.target.value); setSaved(false); }} className="mt-2 h-11" />
                        <p className="mt-1 text-xs text-stone-500">0 = late the day after it&apos;s due.</p>
                      </div>
                      <div>
                        <Label htmlFor="overdue-repeat-days">Remind me again every (days)</Label>
                        <Input id="overdue-repeat-days" type="number" min="1" max="30" value={overdueRepeatDays} onChange={(event) => { setOverdueRepeatDays(event.target.value); setSaved(false); }} className="mt-2 h-11" />
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-stone-100 pt-5">
                    <label className="flex cursor-pointer items-start gap-3">
                      <Checkbox checked={stalledRemindersEnabled} onCheckedChange={(checked) => { setStalledRemindersEnabled(checked === true); setSaved(false); }} />
                      <span>
                        <span className="block text-sm font-semibold text-stone-950">Orders that haven&apos;t moved</span>
                        <span className="mt-1 block text-xs leading-5 text-stone-500">Remind me about orders I haven&apos;t updated in a while.</span>
                      </span>
                    </label>
                    {stalledRemindersEnabled && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="stalled-after-days">After no update for (days)</Label>
                          <Input id="stalled-after-days" type="number" min="1" max="30" value={stalledAfterDays} onChange={(event) => { setStalledAfterDays(event.target.value); setSaved(false); }} className="mt-2 h-11" />
                        </div>
                        <div>
                          <Label htmlFor="stalled-repeat-days">Remind me again every (days)</Label>
                          <Input id="stalled-repeat-days" type="number" min="1" max="30" value={stalledRepeatDays} onChange={(event) => { setStalledRepeatDays(event.target.value); setSaved(false); }} className="mt-2 h-11" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>
          {formFooter}
        </form>
      </div>
    </SettingsSubpage>
  );
}
