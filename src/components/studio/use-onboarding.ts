import { useCallback, useEffect, useState } from "react";

type StoredOnboarding = { welcomed: boolean; guideHidden: boolean };

const storageKey = (userId: string) => `studio-onboarding-v1:${userId}`;

function read(userId: string): StoredOnboarding {
  const fresh = { welcomed: false, guideHidden: false };
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? { ...fresh, ...(JSON.parse(raw) as Partial<StoredOnboarding>) } : fresh;
  } catch {
    return fresh;
  }
}

function write(userId: string, value: StoredOnboarding) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(value));
  } catch {
    // Private windows can block storage; the guide just shows again next visit.
  }
}

/**
 * First-run state: whether to greet the person once, and whether they have
 * hidden the setup checklist. Kept per user on this device.
 */
export function useOnboarding({ userId, serverLoaded, hasData }: { userId: string; serverLoaded: boolean; hasData: boolean }) {
  const [state, setState] = useState<StoredOnboarding | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setState(read(userId));
      setRemindersOn(typeof Notification !== "undefined" && Notification.permission === "granted");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [userId]);

  // Greet only people with nothing set up. Wait for the server answer first so
  // an existing owner on a new device is not welcomed as if they were new.
  useEffect(() => {
    if (!serverLoaded || state === null || state.welcomed) return;
    const frame = window.requestAnimationFrame(() => {
      if (hasData) {
        const next = { ...state, welcomed: true };
        write(userId, next);
        setState(next);
      } else {
        setWelcomeOpen(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [serverLoaded, state, hasData, userId]);

  const update = useCallback((patch: Partial<StoredOnboarding>) => {
    setState((current) => {
      const next = { welcomed: false, guideHidden: false, ...current, ...patch };
      write(userId, next);
      return next;
    });
  }, [userId]);

  return {
    ready: state !== null,
    welcomeOpen,
    openWelcome: () => setWelcomeOpen(true),
    closeWelcome: () => {
      setWelcomeOpen(false);
      update({ welcomed: true });
    },
    guideHidden: state?.guideHidden ?? true,
    hideGuide: () => update({ guideHidden: true }),
    showGuide: () => update({ guideHidden: false }),
    remindersOn,
  };
}
