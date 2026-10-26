import type { FormEvent } from "react";
import { parseMoneyInput } from "@/lib/money";
import { statusLabel } from "./constants";
import { addCalendarDays, dueLabelForDate, fetchJsonWithTimeout, isDateKey, isUuid } from "./format";
import type { BusinessProfile, Expense, Order, Product, Status } from "./types";
import type { useStudioUi } from "./use-studio-ui";
import type { useStudioDerived } from "./use-studio-derived";
import type { useStudioRouting } from "./use-studio-routing";
import type { useStudioData } from "./use-studio-data";
import type { useActionMessage } from "./use-action-message";

export function useStudioActions({ ui, derived, routing, data, messages }: { ui: ReturnType<typeof useStudioUi>; derived: ReturnType<typeof useStudioDerived>; routing: ReturnType<typeof useStudioRouting>; data: ReturnType<typeof useStudioData>; messages: ReturnType<typeof useActionMessage> }) {
  const { custom, productId, saveProduct, selectedOrderId, setCustom, setMessage, setProductId, setSavedOrderConfirmation, setSelectedOrderId, setSummaryMonth, today } = ui;
  const { activeProducts, dueOptions, editingProduct, selected } = derived;
  const { navigate, setView, view } = routing;
  const { orders, products, setBusinessProfile, setExpenses, setOrders, setProducts, setSnoozed, snoozed } = data;
  const { setActionMessage } = messages;
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
  return { openAdd, openNewProduct, openEditProduct, saveProductRecord, toggleProductArchive, deleteProduct, advance, saveOrder, deleteOrder, toggleSnooze, addExpense, addOrder, saveBusinessProfile, replaceLogo, changeSummaryMonth };
}
