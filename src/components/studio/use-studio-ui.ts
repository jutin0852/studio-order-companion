import { useEffect, useState } from "react";
import { dateKey } from "./format";
import type { Message, Status } from "./types";

export function useStudioUi({ initialSummaryMonth }: { initialSummaryMonth?: string | null | undefined }) {
  const [today, setToday] = useState("2000-01-01");
  const [summaryMonth, setSummaryMonth] = useState<string | null>(
    initialSummaryMonth ?? null,
  );
  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setToday(dateKey(new Date())),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [custom, setCustom] = useState(false);
  const [productId, setProductId] = useState("");
  const [saveProduct, setSaveProduct] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);
  const [savedOrderConfirmation, setSavedOrderConfirmation] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("order"),
  );
  return { today, summaryMonth, setSummaryMonth, filter, setFilter, custom, setCustom, productId, setProductId, saveProduct, setSaveProduct, message, setMessage, savedOrderConfirmation, setSavedOrderConfirmation, selectedOrderId, setSelectedOrderId };
}
