import { useEffect, useRef, useState } from "react";
import { defaultSettings, legacyDemoExpenseIds, legacyDemoOrderIds, legacyDemoProductIds } from "./constants";
import { addCalendarDays, dateKey, dueLabelForDate } from "./format";
import { storageKeyPrefix } from "./routing";
import type { BootstrapPayload, BusinessProfile, Expense, Order, Product, Settings, StoredStudioState } from "./types";
import type { useStudioUi } from "./use-studio-ui";
import type { useActionMessage } from "./use-action-message";

export function useStudioData({ userId, initialUserName, ui, messages }: { userId: string; initialUserName?: string | null | undefined; ui: ReturnType<typeof useStudioUi>; messages: ReturnType<typeof useActionMessage> }) {
  const { setProductId, today } = ui;
  const { setActionMessage } = messages;
  const storageKey = `${storageKeyPrefix}:${userId}`;
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [snoozed, setSnoozed] = useState<Record<string, string>>({});
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    ownerName: initialUserName ?? undefined,
  });
  const [hydrated, setHydrated] = useState(false);
  // True once the server has answered (or failed to), so first-run checks never
  // mistake "not loaded yet" for "nothing here".
  const [serverLoaded, setServerLoaded] = useState(false);
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
      })
      .finally(() => {
        if (!cancelled) setServerLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, today, setProductId]);
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
  }, [hydrated, orders, today, setActionMessage]);
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
  return { serverLoaded, orders, setOrders, products, setProducts, snoozed, setSnoozed, expenses, setExpenses, settings, setSettings, businessProfile, setBusinessProfile, hydrated };
}
