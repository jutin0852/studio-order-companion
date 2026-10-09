"use client";

import { useEffect, useState } from "react";
import { Bell, Check, LoaderCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type NotificationPreferences = {
  pushEnabled: boolean;
  dueTodayEnabled: boolean;
  dueSoonEnabled: boolean;
  overdueEnabled: boolean;
};

type PreferenceKey = keyof NotificationPreferences;

const defaultPreferences: NotificationPreferences = { pushEnabled: true, dueTodayEnabled: true, dueSoonEnabled: true, overdueEnabled: true };
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export function PushNotificationSettings() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [secureContext, setSecureContext] = useState(true);
  const [busy, setBusy] = useState(false);
  const [updatingPreference, setUpdatingPreference] = useState<PreferenceKey | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return null;
      const canUsePush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setSecureContext(window.isSecureContext);
      setSupported(canUsePush);
      if (!canUsePush || !window.isSecureContext) return null;
      return Promise.all([
        navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => registration.pushManager.getSubscription()),
        fetch("/api/notifications/preferences", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ preferences?: NotificationPreferences }> : null),
      ]);
    }).then((result) => {
      if (cancelled || !result) return;
      const [currentSubscription, preferencesResponse] = result;
      setSubscription(currentSubscription);
      if (preferencesResponse?.preferences) setPreferences(preferencesResponse.preferences);
    }).catch(() => {
      if (!cancelled) setError("Notifications are not ready on this device yet.");
    });

    return () => { cancelled = true; };
  }, []);

  const updatePreference = async (key: PreferenceKey, value: boolean) => {
    const previous = preferences;
    setUpdatingPreference(key);
    setPreferences((current) => ({ ...current, [key]: value }));
    try {
      const response = await fetch("/api/notifications/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) });
      if (!response.ok) throw new Error("Preference update failed.");
    } catch {
      setPreferences(previous);
      setError("That notification preference could not be saved.");
    } finally {
      setUpdatingPreference(null);
    }
  };

  const enable = async () => {
    if (!vapidPublicKey) { setError("Push notifications are not configured on the server yet."); return; }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked in this browser. Allow them in browser settings, then try again." : "Notification permission was not granted.");
      const registration = await navigator.serviceWorker.ready;
      const nextSubscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
      const response = await fetch("/api/notifications/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextSubscription) });
      if (!response.ok) throw new Error("The notification device could not be saved.");
      setSubscription(nextSubscription);
      await updatePreference("pushEnabled", true);
      setMessage("Notifications are on. Studio will tell you what needs attention.");
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : "Notifications could not be enabled.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!subscription) return;
    setBusy(true);
    setError("");
    try {
      await subscription.unsubscribe();
      const response = await fetch("/api/notifications/subscription", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      if (!response.ok) throw new Error("The notification device could not be removed.");
      setSubscription(null);
      setMessage("Notifications are off on this device.");
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Notifications could not be disabled.");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/notifications/test", { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The test notification could not be sent.");
      setMessage("Test notification sent. Check this device.");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "The test notification could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  const options: { key: Exclude<PreferenceKey, "pushEnabled">; label: string; description: string }[] = [
    { key: "dueTodayEnabled", label: "Due today", description: "A focused reminder for orders that need action today." },
    { key: "dueSoonEnabled", label: "Due soon", description: "A heads-up for orders due in the next two days." },
    { key: "overdueEnabled", label: "Overdue", description: "A persistent alert until an overdue order moves forward." },
  ];

  return <Card className="ring-0"><CardContent className="space-y-5 p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Bell className="h-5 w-5" aria-hidden="true"/></span><div><h2 className="font-semibold text-stone-950">Order notifications</h2><p className="mt-1 text-sm leading-5 text-stone-500">Studio watches the orders that need a next step and nudges you before they slip.</p></div></div>{supported === false && <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">This browser does not support web push notifications.</p>}{supported && !secureContext && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Push notifications need HTTPS on a phone. Localhost is allowed for development; your installed phone app will need an HTTPS address.</p>}{supported && secureContext && <div className="flex flex-wrap items-center gap-2">{subscription ? <><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><Check className="h-4 w-4" aria-hidden="true"/>Enabled on this device</span><Button type="button" variant="outline" onClick={sendTest} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/> : <Smartphone className="h-4 w-4" aria-hidden="true"/>}Send test</Button><Button type="button" variant="ghost" onClick={disable} disabled={busy} className="text-stone-500">Turn off</Button></> : <Button type="button" onClick={enable} disabled={busy} className="bg-brand text-white hover:bg-teal-800">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/> : <Bell className="h-4 w-4" aria-hidden="true"/>}Turn on notifications</Button>}</div>}{supported !== null && <div className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-stone-950">Reminder types</h3><p className="mt-1 text-xs leading-5 text-stone-500">Choose which order moments deserve a push notification.</p></div>{!subscription ? <span className="text-right text-xs font-medium text-stone-400">Turn on notifications first</span> : !supported ? <span className="text-right text-xs font-medium text-stone-400">Not supported here</span> : !secureContext ? <span className="text-right text-xs font-medium text-stone-400">HTTPS required</span> : null}</div><div className="divide-y divide-stone-100 rounded-xl border border-stone-200">{options.map((option) => { const enabled = preferences[option.key]; const disabled = !subscription || !supported || !secureContext || updatingPreference !== null || busy; return <div key={option.key} className="flex min-h-16 items-center justify-between gap-4 p-3"><div className="min-w-0"><p className="text-sm font-semibold text-stone-800">{option.label}</p><p className="mt-1 text-xs leading-5 text-stone-500">{option.description}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`text-xs font-semibold ${disabled ? "text-stone-300" : enabled ? "text-brand" : "text-stone-400"}`}>{enabled ? "On" : "Off"}</span><button type="button" role="switch" aria-checked={enabled} aria-label={`Toggle ${option.label.toLowerCase()} notifications`} title={enabled ? `Turn off ${option.label.toLowerCase()} notifications` : `Turn on ${option.label.toLowerCase()} notifications`} data-state={enabled ? "on" : "off"} disabled={disabled} onClick={() => void updatePreference(option.key, !enabled)} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${enabled ? "border-brand bg-brand" : "border-stone-300 bg-stone-200 hover:bg-stone-300"}`}><span aria-hidden="true" className={`block h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out ${enabled ? "translate-x-5" : "translate-x-0"}`}/></button></div></div>; })}</div></div>}{message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{message}</p>}{error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>}<p className="text-xs leading-5 text-stone-500">Notifications are sent for due dates, overdue orders, and important status changes. You can change these choices any time.</p></CardContent></Card>;
}
