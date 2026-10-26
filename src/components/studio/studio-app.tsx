"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { parseMoneyInput } from "@/lib/money";
import { Add } from "./add-order";
import { defaultSettings, legacyDemoExpenseIds, legacyDemoOrderIds, legacyDemoProductIds, statusLabel } from "./constants";
import { addCalendarDays, dateKey, dueLabelForDate, dueOptionsFor, fetchJsonWithTimeout, isDateKey, isUuid, monthKey } from "./format";
import { AppHeader, MobileNav, Sidebar } from "./navigation";
import { OrderDetail } from "./order-detail";
import { OrderManagement } from "./orders";
import { ProductCatalog, ProductEditor } from "./products";
import { Profile } from "./profile";
import { storageKeyPrefix, viewForPathname, viewPaths } from "./routing";
import { ReceiptsSettingsPage, SettingsHome, SettingsPanel } from "./settings";
import { BusinessSummary, SummaryOrderHistory } from "./summary";
import { Today } from "./today";
import type { ActionFeedback, BootstrapPayload, BusinessProfile, Expense, Message, Order, Product, Settings, Status, StoredStudioState, View } from "./types";

export function StudioLoading() {
  return (
    <main className="min-h-screen bg-mist text-stone-900">
      <div className="mx-auto min-h-screen max-w-6xl bg-white sm:border-x sm:border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 sm:px-8">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-plaster" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-plaster" />
        </div>
        <section
          className="app-content space-y-5 px-5 pt-6 sm:px-8 sm:pt-9"
          aria-busy="true"
          aria-label="Loading Studio"
        >
          <div className="h-9 w-48 animate-pulse rounded-lg bg-plaster" />
          <div className="h-24 rounded-xl bg-plaster/70" />
          <div className="h-48 rounded-xl bg-plaster/70" />
        </section>
      </div>
    </main>
  );
}

export default function Home({
  userId,
  initialUserName,
  initialSummaryMonth,
}: {
  userId: string;
  initialUserName?: string | null;
  initialSummaryMonth?: string | null;
}) {
  const pathname = usePathname();
  const [clientPathname, setClientPathname] = useState(pathname);
  useEffect(() => {
    const syncPathname = () => setClientPathname(window.location.pathname);
    window.addEventListener("popstate", syncPathname);
    return () => window.removeEventListener("popstate", syncPathname);
  }, []);
  // App Router redirects can update pathname before the popstate listener gets
  // a chance to run. Prefer that newer pathname for the current render so a
  // sign-in redirect cannot briefly show the previous screen.
  const view = viewForPathname(
    pathname !== clientPathname ? pathname : clientPathname,
  );
  const navigate = (path: string) => {
    const destination = new URL(path, window.location.href);
    const nextUrl = `${destination.pathname}${destination.search}${destination.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentUrl === nextUrl) return;
    window.history.pushState(null, "", nextUrl);
    setClientPathname(destination.pathname);
  };
  const setView = (nextView: View) => navigate(viewPaths[nextView]);
  const storageKey = `${storageKeyPrefix}:${userId}`;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("[data-page-heading]")?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [view]);
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [custom, setCustom] = useState(false);
  const [productId, setProductId] = useState("");
  const [saveProduct, setSaveProduct] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);
  const [actionMessage, setActionMessageState] = useState<ActionFeedback | null>(null);
  const actionMessageTimerRef = useRef<number | null>(null);
  const nextActionMessageIdRef = useRef(0);
  const setActionMessage = (
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
  };
  useEffect(
    () => () => {
      if (actionMessageTimerRef.current !== null) {
        window.clearTimeout(actionMessageTimerRef.current);
      }
    },
    [],
  );
  const [savedOrderConfirmation, setSavedOrderConfirmation] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [snoozed, setSnoozed] = useState<Record<string, string>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("order"),
  );
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    ownerName: initialUserName ?? undefined,
  });
  const [hydrated, setHydrated] = useState(false);
  const productImagesRef = useRef<string[]>([]);
  const businessLogoRef = useRef<string | undefined>(undefined);
  const pendingOrderSyncRef = useRef(new Set<string>());
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as StoredStudioState;
          if (Array.isArray(parsed.orders))
            setOrders(
              parsed.orders.filter(
                (order) => !legacyDemoOrderIds.has(order.id),
              ),
            );
          if (Array.isArray(parsed.products))
            setProducts(
              parsed.products.filter(
                (product) => !legacyDemoProductIds.has(product.id),
              ),
            );
          if (Array.isArray(parsed.expenses))
            setExpenses(
              parsed.expenses.filter(
                (expense) => !legacyDemoExpenseIds.has(expense.id),
              ),
            );
          if (
            parsed.settings &&
            typeof parsed.settings.workingDays === "number" &&
            typeof parsed.settings.reminderTime === "string"
          ) {
            setSettings({
              ...defaultSettings,
              ...parsed.settings,
              dueSoonDaysBefore: Array.isArray(parsed.settings.dueSoonDaysBefore)
                ? parsed.settings.dueSoonDaysBefore
                : defaultSettings.dueSoonDaysBefore,
              timeZone:
                typeof parsed.settings.timeZone === "string"
                  ? parsed.settings.timeZone
                  : defaultSettings.timeZone,
            });
          }
          if (Array.isArray(parsed.snoozed))
            setSnoozed(
              Object.fromEntries(
                parsed.snoozed.map((id) => [
                  id,
                  addCalendarDays(dateKey(new Date()), 1),
                ]),
              ),
            );
          else if (parsed.snoozed && typeof parsed.snoozed === "object")
            setSnoozed(parsed.snoozed);
          if (parsed.businessProfile)
            setBusinessProfile(parsed.businessProfile);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      } finally {
        setHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);
  useEffect(() => {
    if (!hydrated || today === "2000-01-01") return;
    let cancelled = false;
    fetch("/api/studio/bootstrap", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Studio data is not available from the database.");
        return response.json() as Promise<BootstrapPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        if (Array.isArray(payload.orders)) {
          const serverOrders = payload.orders.map((order) => ({
            ...order,
            due: order.dueDate
              ? dueLabelForDate(order.dueDate, today)
              : order.due,
            synced: true,
          }));
          const serverRequestIds = new Set(
            serverOrders.map((order) => order.clientRequestId).filter(Boolean),
          );
          setOrders((current) => [
            ...current.filter(
              (order) =>
                !order.synced &&
                !serverRequestIds.has(order.clientRequestId ?? ""),
            ),
            ...serverOrders,
          ]);
        }
        if (Array.isArray(payload.products)) {
          setProducts(payload.products);
          setProductId(
            (current) =>
              current ||
              payload.products?.find((product) => !product.archived)?.id ||
              "",
          );
        }
        if (Array.isArray(payload.expenses)) setExpenses(payload.expenses);
        if (payload.settings) setSettings(payload.settings);
        if (payload.profile) setBusinessProfile(payload.profile);
        if (payload.snoozed) setSnoozed(payload.snoozed);
      })
      .catch(() => {
        // Keep the local workspace usable when the database is temporarily unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, today]);
  useEffect(() => {
    if (!hydrated) return;
    const syncPendingOrders = async () => {
      if (!navigator.onLine) return;
      const pending = orders.filter(
        (order) => !order.synced && Boolean(order.clientRequestId),
      );
      for (const order of pending) {
        const requestId = order.clientRequestId as string;
        if (pendingOrderSyncRef.current.has(requestId)) continue;
        pendingOrderSyncRef.current.add(requestId);
        try {
          const response = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerName: order.customer,
              productName: order.product,
              productId: order.productId ?? null,
              amountPaid: order.total,
              dueDate: order.dueDate,
              notes: order.notes ?? "",
              clientRequestId: requestId,
              status: order.status,
            }),
          });
          const payload = (await response.json().catch(() => null)) as {
            order?: Order;
          } | null;
          if (!response.ok || !payload?.order) continue;
          const saved = {
            ...payload.order,
            due: payload.order.dueDate
              ? dueLabelForDate(payload.order.dueDate, today)
              : order.due,
            synced: true,
          };
          setOrders((items) =>
            items.map((item) =>
              item.id === order.id || item.clientRequestId === requestId
                ? saved
                : item,
            ),
          );
          setActionMessage("A pending order synced to your account.");
        } catch {
          // Keep the order queued for the next online event or app refresh.
        } finally {
          pendingOrderSyncRef.current.delete(requestId);
        }
      }
    };
    void syncPendingOrders();
    window.addEventListener("online", syncPendingOrders);
    return () => window.removeEventListener("online", syncPendingOrders);
  }, [hydrated, orders, today]);
  useEffect(() => {
    productImagesRef.current = products.flatMap((product) =>
      product.image ? [product.image] : [],
    );
  }, [products]);
  useEffect(() => {
    businessLogoRef.current = businessProfile.logo;
  }, [businessProfile.logo]);
  useEffect(
    () => () => {
      productImagesRef.current.forEach((image) => {
        if (image.startsWith("blob:")) URL.revokeObjectURL(image);
      });
      const logo = businessLogoRef.current;
      if (logo?.startsWith("blob:")) URL.revokeObjectURL(logo);
    },
    [],
  );
  useEffect(() => {
    if (!hydrated) return;
    const productsForStorage = products.map(({ image, ...product }) =>
      image?.startsWith("blob:")
        ? product
        : { ...product, ...(image ? { image } : {}) },
    );
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        orders,
        products: productsForStorage,
        expenses,
        settings,
        snoozed,
        businessProfile: {
          ownerName: businessProfile.ownerName,
          businessName: businessProfile.businessName,
          ...(businessProfile.logo ? { logo: businessProfile.logo } : {}),
        },
      } satisfies StoredStudioState),
    );
  }, [
    hydrated,
    orders,
    products,
    expenses,
    settings,
    snoozed,
    businessProfile.ownerName,
    businessProfile.businessName,
    businessProfile.logo,
    storageKey,
  ]);
  const dueOptions = useMemo(
    () => dueOptionsFor(today, settings.workingDays),
    [today, settings.workingDays],
  );
  const editingProductId = clientPathname?.match(
    /^\/products\/([^/]+)\/edit$/,
  )?.[1];
  const editingProduct =
    products.find((product) => product.id === editingProductId) ?? null;
  const activeProducts = products.filter((product) => !product.archived);
  const selected =
    products.find((product) => product.id === productId && !product.archived) ??
    activeProducts[0] ??
    products[0];
  const active = orders.filter((order) => order.status !== "delivered");
  const dueToday = useMemo(
    () =>
      active.filter(
        (order) => order.dueDate === today || order.due === "Today",
      ),
    [active, today],
  );
  const attentionOrders = useMemo(
    () =>
      active
        .filter(
          (order) =>
            !order.dueDate || order.dueDate <= addCalendarDays(today, settings.attentionDaysBefore),
        )
        .sort((a, b) => (a.dueDate ?? a.due).localeCompare(b.dueDate ?? b.due)),
    [active, today, settings.attentionDaysBefore],
  );
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const openAdd = (startWithCustomProduct = false) => {
    setMessage(null);
    setProductId(activeProducts[0]?.id ?? "");
    setCustom(startWithCustomProduct || activeProducts.length === 0);
    setView("add");
  };
  const openNewProduct = () => {
    setView("new_product");
  };
  const openEditProduct = (product: Product) => {
    navigate(`/products/${product.id}/edit`);
  };
  const saveProductRecord = async (product: Product) => {
    let savedProduct = product;
    let synced = false;
    try {
      const persisted = isUuid(product.id);
      const response = await fetch(
        persisted
          ? `/api/products/${encodeURIComponent(product.id)}`
          : "/api/products",
        {
          method: persisted ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: product.name,
            price: product.price,
            image: product.image ?? null,
            archived: product.archived ?? false,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        product?: Product;
        error?: string;
      } | null;
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500)
          throw new Error(payload?.error ?? "The product could not be saved.");
        throw new Error("temporary");
      }
      if (!payload?.product) throw new Error("temporary");
      savedProduct = payload.product;
      synced = true;
    } catch (saveError) {
      if (saveError instanceof Error && saveError.message !== "temporary")
        throw saveError;
    }
    if (
      editingProduct?.image &&
      editingProduct.image !== savedProduct.image &&
      editingProduct.image.startsWith("blob:")
    )
      URL.revokeObjectURL(editingProduct.image);
    setProducts((items) =>
      editingProduct
        ? items.map((item) =>
            item.id === editingProduct.id ? savedProduct : item,
          )
        : [...items, savedProduct],
    );
    setProductId(savedProduct.id);
    setView("products");
    setActionMessage(
      synced
        ? `${savedProduct.name} was saved to your product catalog.`
        : `${savedProduct.name} was saved on this device. It will sync when the database is available.`,
    );
  };
  const toggleProductArchive = async (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const nextProduct = { ...product, archived: !product.archived };
    setProducts((items) =>
      items.map((item) => (item.id === id ? nextProduct : item)),
    );
    if (isUuid(id)) {
      try {
        const response = await fetch(
          `/api/products/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: nextProduct.archived }),
          },
        );
        if (!response.ok) throw new Error("Archive state was not saved.");
      } catch {
        setProducts((items) =>
          items.map((item) => (item.id === id ? product : item)),
        );
        setActionMessage(
          "The product changed on this device, but the database could not be updated.",
          "error",
        );
        return;
      }
    }
    setActionMessage(
      `${product.name} was ${product.archived ? "restored to" : "moved to"} your active catalog.`,
    );
  };
  const deleteProduct = async (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return false;

    setProducts((items) => items.filter((item) => item.id !== id));
    if (productId === id) setProductId("");

    if (isUuid(id)) {
      try {
        const response = await fetch(
          `/api/products/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(
            payload?.error ?? "The product could not be deleted.",
          );
        }
      } catch (error) {
        setProducts((items) => [...items, product]);
        setActionMessage(
          error instanceof Error
            ? error.message
            : "The product could not be deleted. Try again.",
          "error",
        );
        return false;
      }
    }

    setActionMessage(`${product.name} was deleted from your catalog.`);
    return true;
  };
  const advance = async (id: string) => {
    const order = orders.find((item) => item.id === id);
    if (!order || order.status === "delivered") return;
    const next: Record<Status, Status> = {
      not_started: "in_progress",
      in_progress: "ready",
      ready: "delivered",
      delivered: "delivered",
    };
    const nextStatus = next[order.status];
    setOrders((items) =>
      items.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item,
      ),
    );
    if (order.synced) {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(order.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          },
        );
        if (!response.ok) throw new Error("Order status was not saved.");
      } catch {
        setOrders((items) =>
          items.map((item) =>
            item.id === id ? { ...item, status: order.status } : item,
          ),
        );
        setActionMessage(
          "The order changed on this device, but the database could not be updated. Try again.",
          "error",
        );
        return;
      }
    }
    setActionMessage(
      `${order.customer}'s order is now ${statusLabel[nextStatus].toLowerCase()}.`,
    );
  };
  const saveOrder = async (nextOrder: Order) => {
    const previous = orders.find((item) => item.id === nextOrder.id);
    if (!previous) return false;
    const persisted = isUuid(nextOrder.id);
    setOrders((items) =>
      items.map((item) => (item.id === nextOrder.id ? nextOrder : item)),
    );
    try {
      const response = await fetch(
        persisted
          ? `/api/orders/${encodeURIComponent(nextOrder.id)}`
          : "/api/orders",
        {
          method: persisted ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: nextOrder.customer,
            productName: nextOrder.product,
            productId: nextOrder.productId ?? null,
            amountPaid: nextOrder.total,
            dueDate: nextOrder.dueDate,
            notes: nextOrder.notes ?? "",
            ...(persisted
              ? {}
              : {
                  status: nextOrder.status,
                  clientRequestId: nextOrder.clientRequestId ?? nextOrder.id,
                }),
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        order?: Order;
        error?: string;
      } | null;
      if (!response.ok || !payload?.order)
        throw new Error(payload?.error ?? "The order could not be saved.");
      const saved = {
        ...payload.order,
        due: payload.order.dueDate
          ? dueLabelForDate(payload.order.dueDate, today)
          : nextOrder.due,
        synced: true,
      };
      setOrders((items) =>
        items.map((item) => (item.id === nextOrder.id ? saved : item)),
      );
      if (selectedOrderId === nextOrder.id && saved.id !== nextOrder.id)
        setSelectedOrderId(saved.id);
      setActionMessage(
        persisted
          ? "Order changes saved to your account."
          : "Offline order synced to your account.",
      );
      return true;
    } catch {
      if (persisted)
        setOrders((items) =>
          items.map((item) => (item.id === nextOrder.id ? previous : item)),
        );
      setActionMessage(
        persisted
          ? "The order could not be saved. Your previous details are still shown."
          : "This order is saved on the device and is waiting for the database.",
        persisted ? "error" : "success",
      );
      return false;
    }
  };
  const deleteOrder = async (order: Order) => {
    const removeFromVisibleOrders = () => {
      setOrders((items) => items.filter((item) => item.id !== order.id));
      setSelectedOrderId(null);
      setActionMessage("Order deleted from your account.");
    };

    if (!isUuid(order.id)) {
      setOrders((items) => items.filter((item) => item.id !== order.id));
      setSelectedOrderId(null);
      setActionMessage("Offline order removed from this device.");
      return true;
    }

    let deleteConfirmed = false;
    try {
      const result = await fetchJsonWithTimeout(
        `/api/orders/${encodeURIComponent(order.id)}`,
        { method: "DELETE" },
        15_000,
      );
      deleteConfirmed = result.ok;
    } catch {
      // The server may have completed the delete even if its response was lost.
    }

    if (deleteConfirmed) {
      removeFromVisibleOrders();
      return true;
    }

    let orderStillExists: boolean | null = null;
    try {
      const result = await fetchJsonWithTimeout(
        "/api/orders",
        { cache: "no-store" },
        5_000,
      );
      const payload = result.payload as { orders?: Array<{ id: string }> } | null;
      if (result.ok && Array.isArray(payload?.orders)) {
        orderStillExists = payload.orders.some((item) => item.id === order.id);
      }
    } catch {
      // Keep the order visible when the server's current state is unknown.
    }

    if (orderStillExists === false) {
      removeFromVisibleOrders();
      return true;
    }

    setActionMessage(
      orderStillExists
        ? "The order is still in your account. Refresh the list before retrying."
        : "We couldn't confirm whether the order was deleted. Refresh the list before retrying.",
      "error",
    );
    return false;
  };
  const toggleSnooze = async (id: string) => {
    const current =
      snoozed[id] && snoozed[id] > today ? snoozed[id] : undefined;
    const nextDate = current ? undefined : addCalendarDays(today, 1);
    const previous = snoozed;
    setSnoozed((items) => {
      const next = { ...items };
      if (nextDate) next[id] = nextDate;
      else delete next[id];
      return next;
    });
    if (!isUuid(id)) return;
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(id)}/snooze`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snoozedUntil: nextDate ?? null }),
        },
      );
      if (!response.ok) throw new Error("The reminder could not be updated.");
      setActionMessage(
        nextDate
          ? "Reminder snoozed until tomorrow."
          : "Reminder snooze removed.",
      );
    } catch {
      setSnoozed(previous);
      setActionMessage("The reminder could not be updated. Try again.", "error");
    }
  };
  const addExpense = async (expense: Expense) => {
    setExpenses((items) => [...items, expense]);
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: expense.label,
          amount: expense.amount,
          date: expense.date,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        expense?: Expense;
      } | null;
      if (!response.ok || !payload?.expense)
        throw new Error("Expense storage is not available.");
      setExpenses((items) =>
        items.map((item) =>
          item.id === expense.id ? (payload.expense as Expense) : item,
        ),
      );
      setActionMessage("Expense recorded to your account.");
    } catch {
      setActionMessage(
        "Expense recorded on this device. It will sync when the database is available.",
      );
    }
  };
  const addOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setActionMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const customer = String(data.get("customer") ?? "").trim();
    const product = custom
      ? String(data.get("customProduct") ?? "").trim()
      : (selected?.name ?? "");
    const total = parseMoneyInput(String(data.get("price") ?? ""));
    const customDueValue = String(data.get("customDueDate") ?? "").trim();
    const dueValue =
      customDueValue || String(data.get("due") ?? dueOptions[0]?.value ?? "");
    if (
      !isDateKey(dueValue) ||
      (customDueValue && customDueValue < today)
    ) {
      setMessage({
        type: "error",
        text: "Choose a valid due date today or later.",
      });
      return;
    }
    const due =
      dueOptions.find((option) => option.value === dueValue)?.label ??
      dueLabelForDate(dueValue, today);
    const notes = String(data.get("notes") ?? "").trim();
    if (!customer || !product) {
      setMessage({
        type: "error",
        text: "Add a customer name and product before saving.",
      });
      return;
    }
    if (total === null || total <= 0) {
      setMessage({
        type: "error",
        text: "Enter the amount paid using digits, optionally grouped like 2,500.",
      });
      return;
    }

    const existingProduct = custom
      ? products.find(
          (item) => item.name.toLowerCase() === product.toLowerCase(),
        )
      : selected;
    let savedProductId =
      existingProduct && isUuid(existingProduct.id) ? existingProduct.id : null;
    if (custom && saveProduct && !existingProduct) {
      const localProduct: Product = {
        id: `local-product-${Date.now()}`,
        name: product,
        price: total,
        color: "bg-plaster",
      };
      setProducts((items) => [...items, localProduct]);
      try {
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: product,
            price: total,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          product?: Product;
        } | null;
        if (response.ok && payload?.product) {
          savedProductId = payload.product.id;
          setProducts((items) =>
            items.map((item) =>
              item.id === localProduct.id ? (payload.product as Product) : item,
            ),
          );
        }
      } catch {
        // The order can still be saved while the new product remains local.
      }
    }

    const localId = `local-${Date.now()}`;
    setOrders((items) => [
      {
        id: localId,
        customer,
        product,
        due,
        dueDate: dueValue,
        total,
        status: "not_started",
        createdAt: today,
        notes,
        clientRequestId: localId,
        synced: false,
      },
      ...items,
    ]);
    form.reset();
    setCustom(false);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customer,
          productName: product,
          productId: savedProductId,
          amountPaid: total,
          dueDate: dueValue,
          notes,
          clientRequestId: localId,
        }),
      });
      if (!response.ok) throw new Error("Order storage is not available.");
      const payload = (await response.json()) as { order?: Order };
      const savedOrder = payload.order;
      if (!savedOrder) throw new Error("The saved order was not returned.");
      setOrders((items) =>
        items.map((item) =>
          item.id === localId
            ? {
                ...savedOrder,
                due: savedOrder.dueDate
                  ? dueLabelForDate(savedOrder.dueDate, today)
                  : due,
                synced: true,
              }
            : item,
        ),
      );
      setView("orders");
      setSavedOrderConfirmation({
        title: "Order saved",
        description: `${product} for ${customer} has been added to your orders.`,
      });
    } catch {
      setView("orders");
      setSavedOrderConfirmation({
        title: "Order saved on this device",
        description: `${product} for ${customer} is in your orders and will sync when your connection is available.`,
      });
    }
  };
  const saveBusinessProfile = async (profile: BusinessProfile) => {
    const nextProfile = {
      businessName: profile.businessName?.trim() || "My business",
      ownerName: profile.ownerName?.trim() ?? "",
      ...(profile.logo ? { logo: profile.logo } : {}),
    } satisfies BusinessProfile;
    setBusinessProfile(nextProfile);
    try {
      const response = await fetch("/api/business-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: nextProfile.businessName,
          ownerName: nextProfile.ownerName,
          logo: profile.logo ?? null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        profile?: BusinessProfile;
      } | null;
      if (!response.ok || !payload?.profile)
        throw new Error("Profile storage is not available.");
      // Keep the normalized draft visible immediately. The successful
      // response confirms the same values were accepted by the API, while
      // avoiding a stale read-back replacing the just-saved card.
      setBusinessProfile(nextProfile);
      setActionMessage("Business profile saved to your account.");
    } catch {
      setActionMessage(
        "Business profile saved on this device. It will sync when the database is available.",
      );
    }
  };
  const replaceLogo = (logo?: string) => {
    setBusinessProfile((profile) => {
      if (
        profile.logo &&
        profile.logo !== logo &&
        profile.logo.startsWith("blob:")
      )
        URL.revokeObjectURL(profile.logo);
      return { ...profile, logo };
    });
  };
  const changeSummaryMonth = (month: string) => {
    setSummaryMonth(month);
    if (view === "summary_orders") {
      const url = new URL(window.location.href);
      url.searchParams.set("month", month);
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  };
  if (!hydrated) return <StudioLoading />;
  return (
    <main className="min-h-screen bg-mist text-stone-900">
      <div className="mx-auto min-h-screen max-w-6xl bg-white sm:border-x sm:border-stone-200">
        <AppHeader
          setView={setView}
          businessLogo={businessProfile.logo}
          ownerName={businessProfile.ownerName}
        />
        <div className="grid lg:grid-cols-[190px_minmax(0,1fr)]">
          <Sidebar view={view} setView={setView} onAdd={openAdd} />
          <section className="app-content min-w-0 px-5 pb-24 pt-6 sm:px-8 sm:pt-9 lg:pb-10">
            {actionMessage && !savedOrderConfirmation && (
              <div
                key={actionMessage.id}
                role={actionMessage.type === "error" ? "alert" : "status"}
                aria-live={actionMessage.type === "error" ? "assertive" : "polite"}
                aria-atomic="true"
                className="pointer-events-none fixed inset-0 z-[100] grid place-items-center px-5"
              >
                <div
                  className={`studio-toast-enter flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-white px-5 py-4 text-sm font-semibold shadow-xl shadow-stone-950/15 ${actionMessage.type === "error" ? "border-rose-200 text-rose-800" : "border-brand/20 text-brand"}`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${actionMessage.type === "error" ? "bg-rose-50" : "bg-brand-soft"}`}
                  >
                    {actionMessage.type === "error" ? (
                      <X className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Check className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <p>{actionMessage.text}</p>
                </div>
              </div>
            )}
            {view === "today" && (
              <Today
                today={today}
                ownerName={businessProfile.ownerName}
                dueToday={dueToday}
                attention={attentionOrders}
                attentionDaysBefore={settings.attentionDaysBefore}
                overdueGraceDays={settings.overdueGraceDays}
                active={active}
                advance={advance}
                goAdd={openAdd}
                goOrders={() => setView("orders")}
                snoozed={snoozed}
                toggleSnooze={toggleSnooze}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "orders" && (
              <OrderManagement
                today={today}
                orders={orders}
                attentionDaysBefore={settings.attentionDaysBefore}
                overdueGraceDays={settings.overdueGraceDays}
                filter={filter}
                setFilter={setFilter}
                advance={advance}
                goAdd={openAdd}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "add" && (
              <Add
                dueOptions={dueOptions}
                products={activeProducts}
                selected={selected}
                productId={productId}
                setProductId={setProductId}
                custom={custom}
                setCustom={setCustom}
                saveProduct={saveProduct}
                setSaveProduct={setSaveProduct}
                addOrder={addOrder}
                message={message}
                workingDays={settings.workingDays}
                today={today}
              />
            )}{" "}
            {view === "products" && (
              <ProductCatalog
                products={products}
                goAdd={openNewProduct}
                onEdit={openEditProduct}
                onToggleArchive={toggleProductArchive}
                onDelete={deleteProduct}
              />
            )}{" "}
            {view === "new_product" && (
              <ProductEditor
                key={editingProduct?.id ?? "new"}
                initial={editingProduct}
                onCancel={() => setView("products")}
                onSave={saveProductRecord}
              />
            )}{" "}
            {view === "profile" && (
              <Profile
                today={today}
                businessLogo={businessProfile.logo}
                ownerName={businessProfile.ownerName}
                businessName={businessProfile.businessName}
                onOwnerNameChange={(ownerName) =>
                  setBusinessProfile((profile) => ({ ...profile, ownerName }))
                }
                onBusinessNameChange={(businessName) =>
                  setBusinessProfile((profile) => ({
                    ...profile,
                    businessName,
                  }))
                }
                onLogoChange={replaceLogo}
                onSaveProfile={saveBusinessProfile}
                onSettings={() => setView("settings")}
                onSummary={() => setView("summary")}
                revenue={orders.reduce((sum, order) => sum + order.total, 0)}
                delivered={
                  orders.filter((order) => order.status === "delivered").length
                }
                expenses={expenses}
                onAddExpense={addExpense}
              />
            )}{" "}
            {view === "summary" && (
              <BusinessSummary
                today={today}
                orders={orders}
                expenses={expenses}
                selectedMonth={summaryMonth ?? monthKey(today)}
                onSelectMonth={changeSummaryMonth}
                onBack={() => setView("profile")}
                onAddOrder={openAdd}
                onViewOrders={(month) => {
                  changeSummaryMonth(month);
                  navigate(`/summary/orders?month=${encodeURIComponent(month)}`);
                }}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "summary_orders" && (
              <SummaryOrderHistory
                today={today}
                orders={orders}
                selectedMonth={summaryMonth ?? monthKey(today)}
                onSelectMonth={changeSummaryMonth}
                onBack={() => setView("summary")}
                onAddOrder={openAdd}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "settings" && (
              <SettingsHome
                onOpen={setView}
                onBack={() => setView("profile")}
              />
            )}
            {(view === "settings_orders" || view === "settings_notifications") && (
              <SettingsPanel
                section={view === "settings_orders" ? "orders" : "notifications"}
                settings={settings}
                onSave={(nextSettings) => {
                  setSettings(nextSettings);
                  setActionMessage("Settings saved.");
                }}
                onBack={() => setView("settings")}
              />
            )}
            {view === "settings_receipts" && (
              <ReceiptsSettingsPage onBack={() => setView("settings")} />
            )}
          </section>
        </div>
        <MobileNav view={view} setView={setView} onAdd={openAdd} />
        {selectedOrder && (
          <OrderDetail
            order={selectedOrder}
            advance={advance}
            onSave={saveOrder}
            onDelete={deleteOrder}
            close={() => setSelectedOrderId(null)}
          />
        )}
        <Dialog
          open={Boolean(savedOrderConfirmation)}
          onOpenChange={(open) => {
            if (!open) {
              setSavedOrderConfirmation(null);
              setActionMessage("");
            }
          }}
        >
          <DialogContent centered className="max-w-sm text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-7 w-7" aria-hidden="true" />
            </span>
            <DialogTitle className="mt-4 text-xl font-bold text-stone-950">
              {savedOrderConfirmation?.title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-stone-600">
              {savedOrderConfirmation?.description}
            </DialogDescription>
            <Button
              type="button"
              autoFocus
              onClick={() => {
                setSavedOrderConfirmation(null);
                setActionMessage("");
              }}
              className="mt-5 w-full bg-stone-950 text-white hover:bg-stone-700"
            >
              Continue to orders
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
