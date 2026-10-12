"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const updateRequested = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    let updateTimer: number | undefined;

    const showWaitingWorker = (worker?: ServiceWorker | null) => {
      const nextWorker = worker ?? registration?.waiting;
      if (!cancelled && nextWorker) {
        setWaitingWorker(nextWorker);
        setDismissed(false);
      }
    };

    const handleUpdateFound = () => {
      const installingWorker = registration?.installing;
      if (!installingWorker) return;

      const handleStateChange = () => {
        if (installingWorker.state !== "installed") return;
        installingWorker.removeEventListener("statechange", handleStateChange);
        if (navigator.serviceWorker.controller) showWaitingWorker(installingWorker);
      };

      installingWorker.addEventListener("statechange", handleStateChange);
    };

    const handleControllerChange = () => {
      if (updateRequested.current) window.location.reload();
    };

    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void registration?.update().catch(() => undefined);
    };

    const checkWhenOnline = () => checkForUpdate();

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", checkWhenOnline);

    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((nextRegistration) => {
      if (cancelled) return;
      registration = nextRegistration;
      showWaitingWorker();
      registration.addEventListener("updatefound", handleUpdateFound);
      updateTimer = window.setInterval(checkForUpdate, 60 * 60 * 1000);
      return registration.update();
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      registration?.removeEventListener("updatefound", handleUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("online", checkWhenOnline);
      if (updateTimer) window.clearInterval(updateTimer);
    };
  }, []);

  if (!waitingWorker || dismissed) return null;

  return <aside role="status" aria-live="polite" className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl shadow-stone-900/10 lg:inset-x-auto lg:bottom-5 lg:right-5">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><RefreshCw className="h-5 w-5" aria-hidden="true" /></span>
    <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-stone-900">A new Studio update is ready.</p>
    <Button type="button" size="sm" onClick={() => { setUpdating(true); updateRequested.current = true; waitingWorker.postMessage({ type: "SKIP_WAITING" }); }} disabled={updating} className="shrink-0 bg-stone-950 text-white hover:bg-stone-700">{updating ? "Updating…" : "Update now"}</Button>
    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setDismissed(true)} disabled={updating} aria-label="Dismiss update" title="Dismiss update" className="shrink-0 text-stone-500"><X className="h-4 w-4" aria-hidden="true" /></Button>
  </aside>;
}
