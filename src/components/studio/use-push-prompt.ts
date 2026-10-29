import { useCallback, useEffect, useState } from "react";
import { enablePush, getPushSubscription, isIosDevice, isStandaloneApp, pushSupported } from "@/lib/push-client";
import { dismissedUntilFrom, pushPromptState, type PushPromptInput } from "./push-prompt-state";

const storageKey = (userId: string) => `studio-push-prompt-v1:${userId}`;

function readDismissedUntil(userId: string) {
  try {
    const value = Number(window.localStorage.getItem(storageKey(userId)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

// `readAt` is when the device was last read, so rendering never needs the clock.
type Device = Omit<PushPromptInput, "now"> & { readAt: number };

/**
 * Whether to ask this person to turn notifications on, and the action that does
 * it. Reads the device once on load, then follows what the person does.
 */
export function usePushPrompt({ userId, paused = false, onEnabled }: { userId: string; paused?: boolean; onEnabled?: () => void }) {
  const [device, setDevice] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Notifications are paused: never ask, and never touch the service worker.
    if (paused) return;
    let cancelled = false;
    const read = async () => {
      const supported = pushSupported();
      let subscribed = false;
      try {
        subscribed = Boolean(await getPushSubscription());
      } catch {
        // No service worker here; treat as not subscribed.
      }
      if (cancelled) return;
      setDevice({
        supported,
        permission: typeof Notification === "undefined" ? "default" : Notification.permission,
        subscribed,
        dismissedUntil: readDismissedUntil(userId),
        isIos: isIosDevice(),
        standalone: isStandaloneApp(),
        readAt: Date.now(),
      });
    };
    const frame = window.requestAnimationFrame(() => void read());
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [userId, paused]);

  const enable = useCallback(async () => {
    if (paused) return;
    setBusy(true);
    setError("");
    try {
      await enablePush();
      await fetch("/api/notifications/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pushEnabled: true }) });
      setDevice((current) => (current ? { ...current, subscribed: true, permission: "granted" } : current));
      onEnabled?.();
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : "Notifications could not be turned on.");
      if (typeof Notification !== "undefined") setDevice((current) => (current ? { ...current, permission: Notification.permission } : current));
    } finally {
      setBusy(false);
    }
  }, [onEnabled, paused]);

  const dismiss = useCallback(() => {
    const until = dismissedUntilFrom(Date.now());
    try {
      window.localStorage.setItem(storageKey(userId), String(until));
    } catch {
      // Not remembered across visits in private windows.
    }
    setDevice((current) => (current ? { ...current, dismissedUntil: until } : current));
  }, [userId]);

  return {
    state: device && !paused ? pushPromptState({ ...device, now: device.readAt }) : ("hidden" as const),
    subscribed: device?.subscribed ?? false,
    busy,
    error,
    enable,
    dismiss,
  };
}
