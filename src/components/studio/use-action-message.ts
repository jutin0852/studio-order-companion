import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionFeedback } from "./types";

export function useActionMessage() {
  const [actionMessage, setActionMessageState] = useState<ActionFeedback | null>(null);
  const actionMessageTimerRef = useRef<number | null>(null);
  const nextActionMessageIdRef = useRef(0);
  // Stable so effects that report messages do not re-run on every render.
  const setActionMessage = useCallback((
    text: string,
    type: ActionFeedback["type"] = "success",
  ) => {
    if (actionMessageTimerRef.current !== null) {
      window.clearTimeout(actionMessageTimerRef.current);
      actionMessageTimerRef.current = null;
    }
    if (!text) {
      setActionMessageState(null);
      return;
    }

    const id = ++nextActionMessageIdRef.current;
    setActionMessageState({ id, type, text });
    actionMessageTimerRef.current = window.setTimeout(() => {
      setActionMessageState((current) => (current?.id === id ? null : current));
      actionMessageTimerRef.current = null;
    }, type === "error" ? 5000 : 3000);
  }, []);
  useEffect(
    () => () => {
      if (actionMessageTimerRef.current !== null) {
        window.clearTimeout(actionMessageTimerRef.current);
      }
    },
    [],
  );
  return { actionMessage, setActionMessage };
}
